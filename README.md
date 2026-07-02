# Bible Echo ✝ (v0.2)

A Chrome extension that finds passages on the **active web page** that semantically
echo the **Bible** — in **5 languages**, with the page's language **auto-detected** —
and links each to the closest chapter. Everything runs **on-device**; nothing is sent
to a server (the optional local-LLM layer talks only to your own machine).

Click the draggable golden **✝ medallion**; it expands into an ornate
French-Catholic-church / early-2000s-kitsch panel with all the controls.

---

## What's in v0.2

- **5 languages**, oldest public-domain translation each (from getbible.net):

  | Lang | Translation | Year |
  |---|---|---|
  | 🇬🇧 English | King James Version | 1611 |
  | 🇫🇷 French | Martin | 1744 |
  | 🇪🇸 Spanish | Sagradas Escrituras (Reina) | 1569 |
  | 🇮🇹 Italian | Giovanni Diodati | 1649 |
  | 🇵🇱 Polish | Biblia Gdańska | 1632/1881 |

- **Automatic language detection** (`chrome.i18n.detectLanguage`) — or pick manually.
- **Chunk-based, lazy analysis** — the page is split into blocks; each is analyzed and
  highlighted **whole** only as it scrolls into view, so large pages load progressively.
- **3 reading modes** — *shown only when the local LLM is enabled* (they shape the
  **per-chunk** analysis prompt + highlight colour):
  - **☩ Neutre** — for each linked idea, whether it *agrees*, *contradicts*, or is *neutral*.
  - **✚ Positif** — focus on where the chunk *aligns with* biblical principles.
  - **⚔ Négatif** — focus on where the chunk *runs counter to* biblical principles.
- **Draggable** medallion (position is remembered) → **expandable panel** with pinned
  controls + an independently **scrolling** results list, plus a **↻ refresh**.

## How it works

```
content.js  (tiny bootstrap) ──dynamic import──▶ ui/app.js  (the in-page app)
   • draggable medallion + church panel + localized text
   • splits the page into chunks; analyzes + highlights each as it scrolls into view (lazy)
   │  ↕ chrome.runtime messages (getSettings / detectLanguage / analyze / reason / warmup)
   ▼
background/service-worker.js  ── language.js: chrome.i18n detects language ──┐
   • routes messages; owns settings; talks to the offscreen doc + Ollama       │
   │  routes "offscreen:*" to ▼                                                │
offscreen/offscreen.js → offscreen/store.js  (page context, holds everything) │
   • Transformers.js tokenizer  (SentencePiece-Unigram, vendored, NO WASM)
   • pruned 256-dim token matrix (int8) + id→row map
   • per-language verse vectors (int8) + gzipped verse text
   • tokenize → look up token rows → average → normalise → cosine vs verses
   └─ optional: background/ollama.js runs ONE per-chunk LLM analysis (align / contradict / toward)
```

## Codebase layout (for maintainers)

Concerns are separated by **execution context** (each file has a JSDoc header explaining
its role). Content scripts can't be ES modules, so `content.js` is a tiny bootstrap that
`import()`s the real app from `ui/` (which is why `ui/`, `core/` and `locales/` are listed
in `web_accessible_resources`).

```
extension/
  manifest.json          MV3 manifest (paths, permissions, web_accessible_resources)
  content.js             classic bootstrap → dynamic-imports ui/app.js
  content.css            document-level ::highlight() paint rules (can't live in shadow DOM)

  ui/                    the in-page app — ES modules, one concern each
    app.js               orchestrator: shadow host, state, wiring, lazy chunk analyze/reason flow
    panel.js             builds the shadow-DOM markup (labels carry data-i18n attributes)
    styles.js            the church-kitsch stylesheet (exported as a string)
    medallion.js         draggable floating button (tap vs drag, position persistence)
    extract.js           page → chunks (leaf blocks) + whole-chunk Range + sentence split
    highlight.js         CSS Custom Highlight API wrapper (tint matches per mode)
    results.js           render per-chunk cards (snippet + linked verses + LLM analysis)
    oracle-ui.js         one-click local-LLM setup UI (progress steps / help / retry)
    i18n.js              locale loader + t("dotted.key", {params}) + localize(root)
    dom.js               tiny esc()/el() helpers

  core/                  shared, chrome-agnostic
    constants.js         LANGS, MODES (glyph + highlight name), highlight registry names
    settings.js          DEFAULTS + getSettings/setSettings (chrome.storage.local)

  background/            service worker, split by concern (ES modules)
    service-worker.js    message router (manifest entry); analyze + reason orchestration
    offscreen-bridge.js  create/query the offscreen doc + request/response messaging
    language.js          auto language detection (chrome.i18n.detectLanguage)
    ollama.js            Ollama HTTP client: reason (3 modes) + setup helpers (version/pull/test)
    oracle-setup.js      one-click enable flow, driven over a runtime port (streamed progress)

  offscreen/             the embedding worker (page context; holds WASM-free tokenizer + matrices)
    offscreen.html/js    hidden page; routes "offscreen:*" messages to store.js
    store.js             tokenize → embed → verse search (mirrors scripts/validate_ml.py)

  locales/               ALL UI text, one file per language (en/fr/es/it/pl) — same key set
  popup.html / popup.js  toolbar popup (at the extension root): blurb + tokenizer self-test
  vendor/transformers/   vendored Transformers.js (tokenizer only, 3 files, no ORT WASM)
  data/                  generated by scripts/ (see "Build the data")
```

**Runtime message protocol** (content UI ⇄ background ⇄ offscreen):

| From → To | Message | Response |
|---|---|---|
| UI → bg | `getSettings` / `setSettings {patch}` | `{ok, settings}` |
| UI → bg | `detectLanguage {sample}` | `{ok, language, detected}` (resolved once per page) |
| UI → bg | `analyze {passages, mode, language}` | `{ok, results, …}` (one call per chunk) |
| UI → bg | `reason {mode, passage, candidates, language}` | `{ok, text}` |
| UI → bg | `warmup` | `{ok}` (spins up the offscreen doc) |
| popup → bg | `selfTest` | `{ok, pass, total, fails}` (tokenizer parity, via offscreen) |
| bg → offscreen | `offscreen:analyze / :warmup / :selfTest` | handled in `offscreen/offscreen.js` |
| UI ⇄ bg (port `be-ollama-setup`) | one-click LLM setup | streamed `{step, state, pct, …}` |

**Common changes**
- **UI wording:** edit `locales/<lang>.json` (never hardcode text in `ui/`). All five files
  share the same key set; a missing key silently falls back to English, then to the raw key
  (no automated parity check ships — keep the key sets in sync when you add strings).
- **Add a UI string:** add the key to every `locales/*.json`, then reference it with
  `data-i18n="my.key"` in `panel.js` (static) or `i18n.t("my.key")` in code (dynamic).
- **Add a language:** add it to `LANGS` in `core/constants.js`, add `locales/<code>.json`,
  add a `data/<code>/` bundle + a `meta.json` entry (re-run `scripts/build_multilingual.py`).
- **Add a setting:** add a default to `core/settings.js` `DEFAULTS`; read it via a
  `getSettings` message in `ui/app.js`; write with `save({key})`.
- **Restyle:** everything visual is in `ui/styles.js` (panel) and `content.css` (page tints).

### Why a *pruned* multilingual model

Multilingual semantic matching needs a multilingual model. The only good static one is
[`potion-multilingual-128M`](https://huggingface.co/minishlab/potion-multilingual-128M)
(500k-token vocab, 256-dim). Bundling it whole is ~180 MB, so the build **prunes** the
token matrix to the ~113k tokens actually used by the 5 Bibles + the most frequent
tokens (for query coverage). Rare/foreign query words fall back to "skip" and degrade
gracefully. Its tokenizer is SentencePiece-Unigram, which a hand-written tokenizer can't
reproduce, so **Transformers.js is vendored as 3 local files (~930 KB) for the tokenizer
only** — the 21 MB ORT WASM is *not* shipped (never needed without an inference session).

**Parity is verified both ways:** the build forces `prepend_scheme="never"` so the Python
tokenizer matches Transformers.js exactly (5/5 on fixtures, in-browser), and the JS
embed→search path reproduces the Python build bit-for-bit (e.g. Spanish *"En el principio
creó Dios los cielos y la tierra"* → Génesis 1:1 @ 1.00).

### Size (honest)

`extension/data` is **~110 MB**: pruned token matrix 29 MB, 5× verse vectors ~40 MB,
tokenizer.json 18.6 MB, 5× gzipped verse text ~6.4 MB, id-map 2 MB. Heavier than the
old English-only 20 MB — that's the cost of 5 languages + a multilingual model.
**To trim:** drop a language (delete its `data/<lang>/` folder + its `meta.json` entry),
or switch verse vectors to binary quantisation (~5 MB total, small quality cost).

## Build the data (already done; re-run only to change languages/model)

```powershell
py -m pip install -r scripts/requirements.txt        # numpy + tokenizers
py scripts/build_multilingual.py                     # downloads model + 5 bibles -> extension/data/
py scripts/vendor_transformers.py                    # vendors Transformers.js (3 local files)
py scripts/validate_ml.py                            # eyeball retrieval per language
```
The 512 MB model is memory-mapped and only the kept rows are read; downloads cache to TEMP.

## Load & try

**The extension (any site):** `chrome://extensions` → Developer mode → **Load unpacked**
→ select `bible-echo/extension`. A ✝ medallion appears — drag it anywhere, click to open,
hit **🕯️ Révéler les échos**. Popup → **Run tokenizer self-test** should report 5/5.

**Instant demo (no install):** serve the folder and open the demo —
```powershell
py -m http.server 8743 --directory "…/bible-echo/extension"
# http://localhost:8743/demo.html
```

## Optional local LLM (Ollama)

Click **⚙ Oracle local → ✨ Enable**. If Ollama isn't reachable, the panel shows an
**OS-tabbed setup guide** (Windows / macOS / Linux, auto-selecting your OS) with the exact
commands to install Ollama, grant *this extension* access (`OLLAMA_ORIGINS` set to your
real `chrome-extension://<id>` origin, the persistent way per OS), and pull the model —
with a **download-size warning** (≈1.3 GB for `llama3.2:1b`; lighter: `qwen2.5:0.5b`). Once
Ollama is reachable, clicking Enable pulls the model automatically (streamed progress). The
guide text lives in `locales/*.json` (`oracle.help.*`); the commands are built in
`ui/oracle-ui.js` (`osCommands`).

**The ☩/✚/⚔ mode picker only appears once the LLM is enabled** — the three modes are
reasoning prompts, so they're meaningless without it. It runs one analysis **per chunk** in
the detected language. Matching works fully without it.

`localhost` is a **required** host permission (localhost-only, can't reach the internet)
so the in-panel toggle works without a separate permission prompt.

## Validated vs. not

- ✅ Multilingual retrieval (Python, all 5 languages)
- ✅ SentencePiece tokenizer in-browser, vendored & local — **5/5 parity**
- ✅ Real `store.js` embed→search end-to-end in a page context (= the offscreen context)
- ⚠️ The extension **packaging** (offscreen lifecycle, message routing, content-script UI,
  drag) is conventional and code-reviewed but not yet run inside Chrome here. First-load
  suspects, if any: offscreen handshake or highlight rendering on unusual pages.

## Limitations / notes

- Matches are *thematic/semantic*, not doctrinal — study prompts, not authority.
- Chapter links open that **chapter in the KJV (English)** on BibleGateway (universal,
  always resolves); the matched verse text is shown inline in the original language.
- The Polish (Gdańska) source lists **book names in English** — a getbible data quirk.
- Only the top frame is analysed (not cross-origin iframes).
```
