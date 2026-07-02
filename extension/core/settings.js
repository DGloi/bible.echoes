// User settings: defaults + persistence in chrome.storage.local under the key
// "settings". Imported by the background worker, the offscreen doc and the popup.
// The in-page content UI does NOT import this — it reads/writes settings by
// messaging the background ("getSettings" / "setSettings"), so there is a single
// storage owner.

/**
 * Default settings, merged under whatever the user has saved.
 * @typedef {Object} Settings
 * @property {number}  minScore        Cosine threshold; below it a passage is "no echo".
 * @property {number}  maxPassages     Cap on passages embedded per page (perf).
 * @property {number}  maxResults      Cap on echoes returned to the panel.
 * @property {'auto'|'en'|'fr'|'es'|'it'|'pl'} language  Target Bible language; 'auto' detects it.
 * @property {'neutral'|'positive'|'negative'} mode      LLM reading mode.
 * @property {boolean} useOllama       Whether the optional local LLM is enabled.
 * @property {string}  ollamaUrl       Base URL of the local Ollama server.
 * @property {string}  ollamaModel     Ollama model tag to use/pull.
 * @property {number}  ollamaTopPassages  How many top echoes to send to the LLM.
 * @property {number|null} fabX        Persisted floating-button X (px from left); null = default corner.
 * @property {number|null} fabY        Persisted floating-button Y (px from top).
 */
export const DEFAULTS = {
  minScore: 0.5, // multilingual cosine sits a touch higher than the old English model
  maxPassages: 150,
  maxResults: 60,
  language: "auto",
  mode: "neutral",
  useOllama: false,
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama3.2:1b",
  ollamaTopPassages: 4,
  fabX: null,
  fabY: null,
};

/** @returns {Promise<Settings>} the saved settings merged over DEFAULTS. */
export async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULTS, ...(settings || {}) };
}

/**
 * Merge `patch` into the saved settings and persist.
 * @param {Partial<Settings>} patch
 * @returns {Promise<Settings>} the new full settings object.
 */
export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}
