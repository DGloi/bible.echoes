// One-click "Enable local LLM" flow: probe Ollama → pull the model (streaming
// progress) → test it. The content UI persists the enabled state. Driven over a port (opened
// by ui/oracle-ui.js) so progress can stream and the worker stays alive during a
// potentially long model download. Importing this module registers the listener.

import { version, ping, pull, test } from "./ollama.js";

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "be-ollama-setup") return;
  port.onMessage.addListener((msg) => {
    if (msg && msg.action === "start") runSetup(port, msg);
  });
});

async function runSetup(port, opts) {
  const url = (opts.url || "http://localhost:11434").trim();
  const model = (opts.model || "llama3.2:1b").trim();
  const post = (m) => { try { port.postMessage(m); } catch {} };
  try {
    // 1. probe
    post({ step: "ping", state: "run" });
    let ver;
    try {
      ver = await version(url);
    } catch (e) {
      // tell the UI whether to show install help or OLLAMA_ORIGINS help
      post({ step: "ping", state: "fail", help: e && e.code === "origins" ? "origins" : "install", id: chrome.runtime.id });
      return;
    }
    post({ step: "ping", state: "ok", text: ver });

    // 2. ensure model present (pull with progress if missing)
    let models = [];
    try { models = await ping(url); } catch {}
    // Match the EXACT requested tag (a bare name implies :latest). Matching only the
    // base name would wrongly skip the pull for a tag the user doesn't actually have,
    // then fail at the test step.
    const want = model.includes(":") ? model : model + ":latest";
    const have = models.some((m) => (m.includes(":") ? m : m + ":latest") === want);
    if (have) {
      post({ step: "model", state: "ok" }); // UI shows a localized "already present"
    } else {
      post({ step: "pull", state: "run", pct: 0 });
      await pull(url, model, ({ status, pct }) => post({ step: "pull", state: "run", pct, text: status }));
      post({ step: "pull", state: "ok" });
    }

    // 3. test + enable
    post({ step: "test", state: "run" });
    await test(url, model);
    post({ step: "test", state: "ok" });

    // The content UI persists llmEnabled/llmProvider on "done" (single settings owner).
    post({ step: "done", state: "ok", model });
  } catch (e) {
    post({ step: "error", state: "fail", text: String((e && e.message) || e) });
  }
}
