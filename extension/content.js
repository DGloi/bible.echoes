// Bible Echo content script — a thin bootstrap. Content scripts can't be ES
// modules directly, so this classic script dynamically imports the real app
// (ui/app.js) from the extension's web-accessible resources. Everything else
// lives in /ui (the in-page app) and /core (shared logic); the heavy embedding +
// LLM work runs in the background + offscreen worker.

(() => {
  if (window.__bibleEchoLoaded) return; // guard against double injection
  window.__bibleEchoLoaded = true;
  import(chrome.runtime.getURL("ui/app.js"))
    .then((mod) => mod.start())
    .catch((err) => console.error("[Bible Echo] failed to load UI:", err));
})();
