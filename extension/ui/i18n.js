// UI localization. Loads locales/<lang>.json (with English as the fallback) and
// resolves dotted keys with {placeholder} interpolation. The active UI language
// follows the panel's selected analysis language (see app.js).
//
// Keep ALL user-facing strings in the locale files — never hardcode text in the
// UI modules. Dynamic strings use t("path", { param }) ; static markup uses the
// data-i18n / data-i18n-title attributes (see localize()).

const localeUrl = (lang) => chrome.runtime.getURL(`locales/${lang}.json`);
const fetchLocale = async (lang) => (await fetch(localeUrl(lang))).json();

/** Resolve a dotted key path ("oracle.steps.ping") against a nested object. */
function lookup(dict, key) {
  return key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

/** Replace {name} placeholders in `str` from `params`. */
function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
}

let _dict = {};
let _fallback = {};

export const i18n = {
  current: "en",

  /** Load a locale (and the English fallback) so subsequent t() calls use it. */
  async load(lang) {
    try {
      _dict = await fetchLocale(lang);
    } catch {
      _dict = {};
    }
    _fallback = lang === "en" ? _dict : await fetchLocale("en").catch(() => ({}));
    this.current = lang;
  },

  /** Translate a key, with {param} interpolation; falls back to English then the key itself. */
  t(key, params) {
    const raw = lookup(_dict, key) ?? lookup(_fallback, key) ?? key;
    return interpolate(raw, params);
  },
};

/**
 * Fill static markup from data-i18n attributes:
 *   <b data-i18n="brand.title"></b>            -> textContent
 *   <button data-i18n-title="actions.refresh"> -> title attribute
 * Call this after building the panel and again whenever the language changes.
 */
export function localize(root) {
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = i18n.t(node.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.title = i18n.t(node.getAttribute("data-i18n-title"));
  });
}
