// Offscreen document: holds the Transformers.js tokenizer + embedding store and
// runs tokenize → embed → verse search off the service worker. The background
// worker routes "offscreen:*" messages here (see background/offscreen-bridge.js).

import { analyzePassages, ready, selfTest } from "./store.js";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("offscreen:")) return; // not for us
  (async () => {
    try {
      switch (msg.type) {
        case "offscreen:warmup":
          await ready();
          sendResponse({ ok: true });
          break;
        case "offscreen:analyze":
          sendResponse({ ok: true, ...(await analyzePassages(msg.passages, msg.language, msg.options)) });
          break;
        case "offscreen:selfTest":
          sendResponse({ ok: true, ...(await selfTest()) });
          break;
        default:
          sendResponse({ ok: false, error: "unknown offscreen message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true; // async response
});
