// Service worker — the message router between the in-page UI and the on-device
// workers. It holds no heavy state itself; it delegates to focused modules:
//   core/settings.js     – settings storage
//   offscreen-bridge.js  – offscreen document lifecycle + messaging
//   language.js          – auto language detection
//   ollama.js            – optional local-LLM reasoning
//   oracle-setup.js      – one-click "enable local LLM" (imported for its port listener)

import { getSettings, setSettings } from "../core/settings.js";
import { reason } from "./ollama.js";
import { ensureOffscreen, toOffscreen } from "./offscreen-bridge.js";
import { detectLang } from "./language.js";
import "./oracle-setup.js"; // side-effect import: registers the be-ollama-setup port handler

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // The offscreen document answers its own "offscreen:*" messages — ignore them here.
  if (!msg || typeof msg.type !== "string" || msg.type.startsWith("offscreen:")) return;
  (async () => {
    try {
      switch (msg.type) {
        case "getSettings":
          sendResponse({ ok: true, settings: await getSettings() });
          break;
        case "setSettings":
          sendResponse({ ok: true, settings: await setSettings(msg.patch || {}) });
          break;
        case "detectLanguage": {
          const st = await getSettings();
          if (st.language && st.language !== "auto") {
            sendResponse({ ok: true, language: st.language, detected: false });
          } else {
            const detected = await detectLang((msg.sample || "").slice(0, 1000));
            sendResponse({ ok: true, language: detected || "en", detected: !!detected });
          }
          break;
        }
        case "warmup":
          await ensureOffscreen();
          await toOffscreen({ type: "offscreen:warmup" });
          sendResponse({ ok: true });
          break;
        case "selfTest":
          await ensureOffscreen();
          sendResponse(await toOffscreen({ type: "offscreen:selfTest" }));
          break;
        case "analyze":
          sendResponse(await analyze(msg));
          break;
        case "reason":
          sendResponse(await runReason(msg));
          break;
        default:
          sendResponse({ ok: false, error: "unknown message: " + msg.type });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true; // keep the channel open for the async sendResponse
});

/** Resolve the target language (detecting it when set to "auto") and run the search offscreen. */
async function analyze(msg) {
  const s = await getSettings();
  await ensureOffscreen();
  let lang = msg.language || s.language || "auto";
  let detected = null;
  if (lang === "auto") {
    const sample = (msg.passages || []).slice(0, 50).join("  ").slice(0, 1000);
    detected = await detectLang(sample);
    lang = detected || "en";
  }
  const r = await toOffscreen({
    type: "offscreen:analyze",
    passages: msg.passages,
    language: lang,
    options: { minScore: s.minScore, maxPassages: s.maxPassages, maxResults: s.maxResults },
  });
  if (!r || !r.ok) return r || { ok: false, error: "offscreen did not respond" };
  return {
    ...r,
    languageUsed: lang,
    detected,
    mode: msg.mode || s.mode,
    useOllama: s.useOllama,
    ollamaTopPassages: s.ollamaTopPassages,
  };
}

/** Ask the local LLM to reason about the top matches (only if the user enabled it). */
async function runReason(msg) {
  const s = await getSettings();
  if (!s.useOllama) return { ok: false, error: "Local LLM is off." };
  const text = await reason({
    url: s.ollamaUrl,
    model: s.ollamaModel,
    mode: msg.mode || s.mode,
    passage: msg.passage,
    candidates: msg.candidates,
    language: msg.language,
  });
  return { ok: true, text };
}
