// Splits the page into "chunks" — leaf block-level text elements (a <p>, <li>,
// heading, blockquote, table cell, …). Analysis is driven lazily per chunk as each
// scrolls into view (see app.js IntersectionObserver), so big pages load
// progressively. Highlighting is per-chunk (the whole block), which is why we no
// longer need text-node offset → Range mapping.

const SKIP_UI = "[data-be-ui]";
const SKIP_TAG = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "SVG", "CANVAS"]);
// Leaf text containers we treat as chunks. We keep only elements that don't contain
// another one of these (so a <ul> yields its <li>s, not the whole list as one chunk).
const BLOCK_SEL = "p, li, blockquote, h1, h2, h3, h4, h5, h6, dd, dt, figcaption, pre, td, th, caption, summary";
const MIN_CHUNK_CHARS = 40;
const MAX_SENTENCE = 280;

function isVisible(el) {
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
  return el.offsetParent !== null || cs.position === "fixed";
}

/**
 * @returns {{ el: Element, text: string }[]} visible leaf text blocks, in document order.
 */
export function extractChunks() {
  const out = [];
  const candidates = document.body ? document.body.querySelectorAll(BLOCK_SEL) : [];
  for (const el of candidates) {
    if (SKIP_TAG.has(el.tagName) || el.closest(SKIP_UI)) continue;
    if (el.querySelector(BLOCK_SEL)) continue; // container of other blocks → its leaves are the chunks
    if (!isVisible(el)) continue;
    const text = (el.innerText || "").replace(/\s+/g, " ").trim();
    if (text.length < MIN_CHUNK_CHARS) continue;
    out.push({ el, text });
  }
  return out;
}

/** A live Range spanning a chunk element's contents, for whole-chunk highlighting. */
export function chunkRange(el) {
  try {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.collapsed ? null : r;
  } catch {
    return null;
  }
}

/**
 * Split a chunk's text into sentence-ish units for embedding (finer than a whole
 * paragraph → better verse matches). Short fragments are dropped; very long ones split.
 * @returns {string[]}
 */
export function splitSentences(text) {
  const out = [];
  for (let part of text.split(/(?<=[.!?…])\s+|\n+/)) {
    part = part.trim();
    if (part.length < 20) continue;
    while (part.length > MAX_SENTENCE) {
      out.push(part.slice(0, MAX_SENTENCE));
      part = part.slice(MAX_SENTENCE);
    }
    out.push(part);
  }
  return out;
}
