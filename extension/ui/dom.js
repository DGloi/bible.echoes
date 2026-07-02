// Tiny DOM helpers shared across the UI modules. No app state here.

/** Escape a string for safe insertion as HTML text/attribute content. */
export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Create an element with optional class and innerHTML. */
export function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

/** Returns a `$`-style query function scoped to `root` (a ShadowRoot or Element). */
export const scopedQuery = (root) => (selector) => root.querySelector(selector);
