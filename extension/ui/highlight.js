// Thin wrapper over the CSS Custom Highlight API. Tints matched page text without
// mutating the DOM. The ::highlight() paint rules live in content.css (document-scoped).

import { HL_NAMES, HL_ACTIVE } from "../core/constants.js";

/** Whether the browser supports the CSS Custom Highlight API (Chrome/Edge 105+). */
export const SUPPORTED =
  typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";

/** Remove every highlight this app registers. */
export function clearAll() {
  if (SUPPORTED) HL_NAMES.forEach((name) => CSS.highlights.delete(name));
}

/** Clear existing highlights and paint `ranges` under the given registry name (per mode). */
export function paint(name, ranges) {
  if (!SUPPORTED) return;
  clearAll();
  if (ranges.length) CSS.highlights.set(name, new Highlight(...ranges));
}

/** Briefly flash a single range (used when you click a verse in the results list). */
export function flash(range) {
  if (!SUPPORTED || !range) return;
  CSS.highlights.set(HL_ACTIVE, new Highlight(range));
  setTimeout(() => CSS.highlights.delete(HL_ACTIVE), 1500);
}
