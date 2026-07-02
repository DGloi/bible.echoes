// Orchestrator for the in-page app. Owns the panel's shadow root, the runtime
// state, and all event wiring; delegates each concern to a focused module:
//   panel.js     – markup           medallion.js – draggable button
//   i18n.js      – localized text    extract.js   – page → chunks + sentence split
//   highlight.js – tint matches      results.js   – per-chunk result cards
//   oracle-ui.js – local-LLM setup
//
// Analysis is CHUNK-based and lazy: the page is split into block-level chunks, and
// each is analyzed only when it scrolls into view (IntersectionObserver) — so large
// pages load progressively. A matched chunk is highlighted whole and gets one card
// listing its linked verses + (optionally) a single per-chunk LLM analysis of how it
// aligns with / contradicts / relates to those verses. Embedding + LLM work happens
// in the background + offscreen worker; this module talks to them via runtime messages.

import { LANGS, MODES } from "../core/constants.js";
import { i18n, localize } from "./i18n.js";
import { buildShadow } from "./panel.js";
import { initMedallion } from "./medallion.js";
import { extractChunks, chunkRange, splitSentences } from "./extract.js";
import * as hl from "./highlight.js";
import { makeChunkCard, setAnalysis, renderEmpty } from "./results.js";
import { createOracle } from "./oracle-ui.js";

const send = (msg) => chrome.runtime.sendMessage(msg);
const TOP_VERSES_PER_CHUNK = 4; // how many distinct verses to list/feed the LLM per chunk

/** Entry point — called once by the content-script bootstrap (content.js). */
export async function start() {
  const state = {
    settings: {},
    chunks: [], // [{ el, text, analyzed?, analyzing?, links?, range?, card? }]
    chunkByEl: new Map(),
    observer: null,
    lang: "en",
    langDisplay: "en",
    detected: false,
    done: 0, // chunks analyzed
    hits: 0, // chunks with ≥1 linked verse
    llmQueue: [],
    llmBusy: false,
    open: false,
    busy: false,
  };

  // ---- shadow host (fixed, anchored bottom-right until dragged) ----
  const host = document.createElement("div");
  host.setAttribute("data-be-ui", "");
  host.style.cssText = "all:initial; position:fixed; z-index:2147483647; right:18px; bottom:18px;";
  const root = buildShadow(host);
  (document.documentElement || document.body).appendChild(host);
  const $ = (sel) => root.querySelector(sel);

  const fab = $(".fab");
  const panel = $(".panel");
  const badge = $(".badge");
  const statusEl = $("#status");
  const resultsEl = $("#results");
  const langSel = $("#lang");
  const modeRow = $("#modeRow");

  // ---- load settings (background owns storage) ----
  try {
    const r = await send({ type: "getSettings" });
    state.settings = (r && r.ok && r.settings) || {};
  } catch {
    state.settings = {};
  }
  const s = state.settings;

  // UI language follows the chosen analysis language; for "auto" prefer the browser's
  // language if supported, else French (the app's flagship theme).
  const uiLang = () => {
    const sel = state.settings.language || "auto";
    if (sel !== "auto") return sel;
    const codes = LANGS.map((l) => l.code);
    for (const nav of navigator.languages || []) {
      const c = (nav || "").slice(0, 2);
      if (codes.includes(c)) return c;
    }
    return "fr";
  };
  await i18n.load(uiLang());
  localize(root);

  // ---- initial control values ----
  $("#thr").value = s.minScore ?? 0.5;
  $("#thrv").textContent = Number($("#thr").value).toFixed(2);
  langSel.value = s.language || "auto";
  setMode(s.mode || "neutral", false);
  $("#counter").textContent = String(1000 + Math.floor((Date.now() / 60000) % 8000)).padStart(7, "0");
  updateModeRow();

  // ---- draggable medallion ----
  const medallion = initMedallion({
    host,
    fab,
    initial: { x: s.fabX, y: s.fabY },
    onTap: togglePanel,
    onDrag: () => { if (state.open) positionPanel(); },
    onDrop: (x, y) => save({ fabX: x, fabY: y }),
  });

  // ---- optional LLM setup (oracle-ui owns the whole gear UI: provider, Ollama, OpenAI) ----
  createOracle({
    root,
    save,
    getSettings: () => state.settings,
    onChange: () => {
      updateModeRow();
      recolor();
      requeueLLM(); // (re)analyze shown chunks under the current LLM state
    },
  });

  // ---- event wiring ----
  $("#thr").addEventListener("input", () => { $("#thrv").textContent = Number($("#thr").value).toFixed(2); });
  $("#thr").addEventListener("change", () => save({ minScore: Number($("#thr").value) }));
  langSel.addEventListener("change", async () => {
    save({ language: langSel.value });
    await i18n.load(uiLang());
    localize(root);
  });
  $("#reveal").addEventListener("click", reveal);
  $("#supportClose").addEventListener("click", () => { $("#supportPrompt").hidden = true; });
  root.querySelectorAll(".mode").forEach((m) => m.addEventListener("click", () => setMode(m.dataset.mode, true)));
  window.addEventListener("resize", () => {
    medallion.place(host.offsetLeft, host.offsetTop); // re-clamp so it can't strand off-screen
    if (state.open) positionPanel();
  });

  // warm the offscreen worker so the first analysis is fast
  send({ type: "warmup" }).catch(() => {});

  // ---------------- helpers (closures over state/root) ----------------
  function save(patch) {
    state.settings = { ...state.settings, ...patch };
    send({ type: "setSettings", patch });
  }
  // Modes are LLM reasoning prompts, so the picker only matters when the LLM is on.
  const effMode = () => (state.settings.llmEnabled ? state.settings.mode || "neutral" : "neutral");
  function updateModeRow() { modeRow.style.display = state.settings.llmEnabled ? "flex" : "none"; }
  function setStatus(text, err) { statusEl.textContent = text; statusEl.classList.toggle("err", !!err); }
  function setBusy(b) { state.busy = b; fab.classList.toggle("busy", b); }

  function setMode(mode, rerender) {
    state.settings.mode = mode;
    root.querySelectorAll(".mode").forEach((m) => m.classList.toggle("on", m.dataset.mode === mode));
    if (rerender) {
      save({ mode });
      recolor();
      requeueLLM(); // re-run the per-chunk analysis under the new lens
    }
  }

  function positionPanel() {
    const r = host.getBoundingClientRect();
    const pw = 372;
    const ph = Math.min(window.innerHeight * 0.78, panel.offsetHeight || 420);
    let left = r.left + r.width + 10;
    if (left + pw > window.innerWidth) left = r.left - pw - 10;
    if (left < 6) left = 6;
    let top = r.top + r.height / 2 - ph / 2;
    top = Math.max(6, Math.min(window.innerHeight - ph - 6, top));
    panel.style.left = left + "px";
    panel.style.top = top + "px";
  }
  function togglePanel() {
    state.open = !state.open;
    panel.classList.toggle("open", state.open);
    if (state.open) {
      positionPanel();
      if (!state.chunks.length) reveal();
    }
  }

  // ---- chunk-based lazy analysis ----
  async function reveal() {
    if (state.busy) return;
    clear();
    setBusy(true);
    setStatus(i18n.t("status.reading"));
    try {
      const chunks = extractChunks();
      state.chunks = chunks;
      for (const c of chunks) state.chunkByEl.set(c.el, c);
      if (!chunks.length) {
        setStatus(i18n.t("status.noText"), true);
        renderEmpty(resultsEl, "—");
        setBusy(false);
        return;
      }
      // resolve the page language once, from a page-wide sample
      const sample = chunks.slice(0, 40).map((c) => c.text).join("  ").slice(0, 1000);
      let lr;
      try { lr = await send({ type: "detectLanguage", sample }); } catch {}
      state.lang = (lr && lr.ok && lr.language) || "en";
      state.detected = !!(lr && lr.detected);
      state.langDisplay = state.lang + (state.settings.language === "auto" && state.detected ? i18n.t("status.autoTag") : "");
      // analyze each chunk as it scrolls into view (300px look-ahead)
      state.observer = new IntersectionObserver(onIntersect, { rootMargin: "300px 0px" });
      for (const c of chunks) state.observer.observe(c.el);
      updateStatus();
    } catch (e) {
      setStatus(i18n.t("status.error") + (e.message || e), true);
    }
    setBusy(false);
  }

  function onIntersect(entries) {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const chunk = state.chunkByEl.get(e.target);
      if (chunk) analyzeChunk(chunk);
    }
  }

  async function analyzeChunk(chunk) {
    if (chunk.analyzed || chunk.analyzing) return;
    chunk.analyzing = true;
    const passages = splitSentences(chunk.text);
    if (!passages.length) {
      chunk.analyzed = true;
      chunk.analyzing = false;
      state.done++;
      updateStatus();
      return;
    }
    let resp;
    try {
      resp = await send({ type: "analyze", passages, language: state.lang, mode: effMode() });
    } catch {
      chunk.analyzing = false; // transient — allow a retry on the next intersection
      return;
    }
    chunk.analyzed = true;
    chunk.analyzing = false;
    state.done++;
    if (resp && resp.ok && Array.isArray(resp.results) && resp.results.length) {
      // dedup verses across the chunk's passages, keep the best score for each
      const byRef = new Map();
      for (const r of resp.results) {
        for (const h of r.hits) {
          const cur = byRef.get(h.ref);
          if (!cur || h.score > cur.score) byRef.set(h.ref, h);
        }
      }
      chunk.links = [...byRef.values()].sort((a, b) => b.score - a.score).slice(0, TOP_VERSES_PER_CHUNK);
      if (chunk.links.length) {
        chunk.range = chunkRange(chunk.el);
        state.hits++;
        recolor();
        chunk.card = makeChunkCard(chunk, () => scrollToChunk(chunk));
        resultsEl.appendChild(chunk.card);
        if (state.settings.llmEnabled) enqueueLLM(chunk);
      }
    }
    updateStatus();
  }

  function updateStatus() {
    const total = state.chunks.length;
    setStatus(i18n.t("status.chunks", { hits: state.hits, done: state.done, total, lang: state.langDisplay }));
    badge.style.display = state.hits ? "block" : "none";
    badge.textContent = state.hits;
    if (total && state.done >= total && state.hits === 0) renderEmpty(resultsEl, i18n.t("results.empty"));
    maybeShowSupport();
  }
  // One-time, gentle "buy me a coffee" nudge, shown after the first analysis that finds echoes.
  function maybeShowSupport() {
    if (state.settings.supportSeen || !state.hits) return;
    save({ supportSeen: true });
    const el = $("#supportPrompt");
    if (el) el.hidden = false;
  }

  function recolor() {
    const ranges = state.chunks.filter((c) => c.range && c.links && c.links.length).map((c) => c.range);
    hl.paint(MODES[effMode()].hl, ranges);
  }

  function scrollToChunk(chunk) {
    chunk.el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (chunk.range) hl.flash(chunk.range);
  }

  function clear() {
    if (state.observer) { state.observer.disconnect(); state.observer = null; }
    hl.clearAll();
    state.chunks = [];
    state.chunkByEl = new Map();
    state.llmQueue = [];
    state.done = 0;
    state.hits = 0;
    resultsEl.innerHTML = "";
    badge.style.display = "none";
  }

  // ---- per-chunk LLM analysis (sequential queue so we don't hammer Ollama) ----
  function enqueueLLM(chunk) {
    state.llmQueue.push(chunk);
    processLLM();
  }
  function requeueLLM() {
    if (!state.settings.llmEnabled) return;
    state.llmQueue = state.chunks.filter((c) => c.card && c.links && c.links.length);
    processLLM();
  }
  async function processLLM() {
    if (state.llmBusy) return;
    state.llmBusy = true;
    while (state.llmQueue.length) {
      const chunk = state.llmQueue.shift();
      if (!chunk.card || !chunk.links || !chunk.links.length) continue;
      const mode = effMode();
      setAnalysis(chunk.card, mode, i18n.t("oracle.meditating"));
      try {
        const r = await send({
          type: "reason",
          mode,
          passage: chunk.text.slice(0, 1400),
          candidates: chunk.links.map((v) => ({ ref: v.ref, text: v.text })),
          language: state.settings.language === "auto" ? state.lang : state.settings.language,
        });
        if (r && r.ok) setAnalysis(chunk.card, mode, "✦ " + r.text);
        else setAnalysis(chunk.card, mode, "⚠ " + ((r && r.error) || i18n.t("oracle.unavailable")), true);
      } catch (e) {
        setAnalysis(chunk.card, mode, "⚠ " + (e.message || e), true);
      }
    }
    state.llmBusy = false;
  }
}
