// Pure, environment-agnostic constants shared by every surface (background,
// offscreen, popup, and the in-page UI). NOTHING here touches chrome.*, so this
// module is safe to import from the content-script world.

/**
 * Supported analysis languages. `name` is the endonym — shown verbatim in every
 * UI locale (we don't translate "Français" to "French" in the English UI). The
 * matching Bible data lives under data/<code>/ and is described in data/meta.json.
 * @type {{code: string, name: string, flag: string}[]}
 */
export const LANGS = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
];

/** Just the language codes, e.g. for membership checks. */
export const LANG_CODES = LANGS.map((l) => l.code);

/**
 * The three LLM reading modes. Only structural data lives here — the human-readable
 * labels/titles are localized in locales/<lang>.json under `modes`.
 *  - glyph: shown on the mode button
 *  - hl:    the CSS Custom Highlight registry name used to tint matches in this mode
 * @type {Record<'neutral'|'positive'|'negative', {glyph: string, hl: string}>}
 */
export const MODES = {
  neutral: { glyph: "☩", hl: "bible-echo" },
  positive: { glyph: "✚", hl: "bible-echo-positive" },
  negative: { glyph: "⚔", hl: "bible-echo-negative" },
};

/** Highlight name used to briefly flash the verse you click in the results list. */
export const HL_ACTIVE = "bible-echo-active";

/** Every CSS Custom Highlight name we register — used to clear them all at once. */
export const HL_NAMES = [...Object.values(MODES).map((m) => m.hl), HL_ACTIVE];
