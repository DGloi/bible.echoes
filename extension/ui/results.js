// Renders the results list as one card PER CHUNK: a snippet of the page chunk, the
// Bible verses it links to, and an optional per-chunk LLM analysis (how the chunk
// aligns with / contradicts / relates to those verses). Pure view code.

import { esc } from "./dom.js";

/** Render a placeholder/empty message into the results container. */
export function renderEmpty(container, message) {
  container.innerHTML = `<div class="empty">${esc(message)}</div>`;
}

/**
 * Build a card for one analyzed chunk. The caller appends it and later fills the
 * analysis slot via setAnalysis().
 * Each verse shows its reference, score, AND the verse text itself (already in the
 * target language — store.js returns the matched language's wording).
 * @param {{text:string, links:{ref:string,score:number,text:string,chapterUrl:string}[]}} chunk
 * @param {() => void} onSelect  click handler (ignores clicks on verse links)
 * @returns {HTMLElement}
 */
export function makeChunkCard(chunk, onSelect) {
  const node = document.createElement("div");
  node.className = "chunk";
  const verses = chunk.links
    .map(
      (v) =>
        `<div class="vitem"><a class="ref" href="${esc(v.chapterUrl)}" target="_blank" rel="noopener">${esc(v.ref)}</a>` +
        `<span class="score">${(v.score * 100).toFixed(0)}%</span>` +
        `<div class="vtext">${esc(v.text)}</div></div>`
    )
    .join("");
  node.innerHTML = `<div class="snip"></div><div class="verses">${verses}</div><div class="analysis" hidden></div>`;
  node.querySelector(".snip").textContent =
    "“" + chunk.text.slice(0, 120) + (chunk.text.length > 120 ? "…" : "") + "”";
  node.addEventListener("click", (ev) => {
    if (ev.target.tagName === "A") return; // let verse links open normally
    onSelect();
  });
  return node;
}

/**
 * Fill/replace a chunk card's analysis line.
 * @param {HTMLElement} card    a card from makeChunkCard
 * @param {string} mode         'neutral' | 'positive' | 'negative' (accent colour)
 * @param {string} text         the message
 * @param {boolean} [isError]
 */
export function setAnalysis(card, mode, text, isError) {
  const el = card.querySelector(".analysis");
  el.hidden = false;
  el.className = "analysis " + (isError ? "err" : mode);
  el.textContent = text;
}
