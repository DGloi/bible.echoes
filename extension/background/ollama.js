// Ollama HTTP client (background-only). Reasoning prompts for the three modes,
// plus the one-click setup helpers (probe / pull / test). Requires the localhost
// host permission and `OLLAMA_ORIGINS=chrome-extension://<id>` on the server.

const LANG_NAME = { en: "English", fr: "French", es: "Spanish", it: "Italian", pl: "Polish" };

/**
 * Build the per-chunk analysis prompt. Given a page chunk + candidate verses, the LLM
 * finds the idea(s) in the chunk that link to Scripture and, per the mode, explains the
 * relationship:
 *   neutral  – for each linked idea, say whether it AGREES / CONTRADICTS / is NEUTRAL, and why
 *   positive – focus on where the chunk ALIGNS WITH biblical principles
 *   negative – focus on where the chunk CONFLICTS WITH biblical principles
 */
function buildPrompt(mode, passage, list, language) {
  const lang = LANG_NAME[language] || "the same language as the passage";
  const head =
    `Here is a passage from a web page:\n"""\n${passage}\n"""\n\n` +
    `Candidate Bible verses that may relate to it:\n${list}\n\n`;
  const task =
    mode === "positive"
      ? `Identify the idea(s) in the passage that ALIGN WITH or echo biblical principles. For each, cite the most relevant verse and say briefly how it agrees.`
      : mode === "negative"
      ? `Identify the idea(s) in the passage that CONFLICT WITH or run counter to biblical principles. For each, cite the most relevant verse and say briefly how it clashes. Be critical but fair.`
      : `Identify which idea(s) in the passage relate to Scripture. For each, cite the most relevant verse and state whether the passage AGREES WITH, CONTRADICTS, or is NEUTRAL toward that biblical principle, and why.`;
  return head + task + ` Be concise: at most 3 short points. If nothing truly relates, say so. Answer in ${lang}, no preamble.`;
}

export async function reason({ url, model, mode, passage, candidates, language, signal }) {
  const list = candidates.map((c, i) => `${i + 1}. ${c.ref} — ${c.text}`).join("\n");
  const res = await fetch(url.replace(/\/+$/, "") + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "user", content: buildPrompt(mode, passage, list, language) }],
      options: { temperature: 0.2 },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}. ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  return (data && data.message && data.message.content ? data.message.content : "").trim();
}

/** List installed model tags, e.g. ["llama3.2:1b", …]. */
export async function ping(url) {
  const res = await fetch(url.replace(/\/+$/, "") + "/api/tags");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()).models || []).map((m) => m.name);
}

// ---- one-click setup helpers ----

/**
 * Probe reachability. Distinguishes "not running" (fetch throws → code "offline")
 * from "running but this extension's origin is blocked" (HTTP 403 → code "origins").
 * @returns {Promise<string>} the Ollama version string.
 */
export async function version(url) {
  let res;
  try {
    res = await fetch(url.replace(/\/+$/, "") + "/api/version");
  } catch {
    const err = new Error("offline");
    err.code = "offline";
    throw err;
  }
  if (res.status === 403) {
    const err = new Error("origin blocked");
    err.code = "origins";
    throw err;
  }
  if (!res.ok) throw new Error("HTTP " + res.status);
  return (await res.json()).version || "?";
}

/** Pull a model, reporting streamed progress via onProgress({status, pct}). */
export async function pull(url, model, onProgress) {
  const res = await fetch(url.replace(/\/+$/, "") + "/api/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model, stream: true }),
  });
  if (!res.ok) throw new Error("pull HTTP " + res.status);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      if (j.error) throw new Error(j.error);
      const pct = j.total && j.completed ? Math.round((100 * j.completed) / j.total) : null;
      onProgress({ status: j.status || "", pct });
    }
  }
}

/** Send a tiny prompt to confirm the model actually responds. */
export async function test(url, model) {
  const res = await fetch(url.replace(/\/+$/, "") + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, messages: [{ role: "user", content: "Reply with one word: ready" }], options: { num_predict: 8 } }),
  });
  if (!res.ok) throw new Error("test HTTP " + res.status);
  return ((await res.json()).message?.content || "").trim();
}
