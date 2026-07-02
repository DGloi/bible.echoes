// Auto language detection for the "auto" setting, using Chrome's built-in
// chrome.i18n.detectLanguage. Returns the first detected language we actually
// support (see core/constants.js), or null to let the caller fall back.

import { LANG_CODES } from "../core/constants.js";

const SUPPORTED = new Set(LANG_CODES);

/** @param {string} text  a sample of page text @returns {Promise<string|null>} */
export async function detectLang(text) {
  try {
    if (!chrome.i18n || !chrome.i18n.detectLanguage) return null;
    const res = await chrome.i18n.detectLanguage(text);
    for (const l of res.languages || []) {
      const c = (l.language || "").split("-")[0];
      if (SUPPORTED.has(c)) return c;
    }
  } catch {}
  return null;
}
