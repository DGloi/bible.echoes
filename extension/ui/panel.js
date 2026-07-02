// Builds the shadow-DOM markup for the medallion + panel. Text is NOT inlined:
// every label carries a data-i18n / data-i18n-title attribute that i18n.localize()
// fills from the active locale, so the panel re-localizes on language change without
// being rebuilt. Structural data (languages, modes) comes from core/constants.js.

import { STYLES } from "./styles.js";
import { LANGS, MODES } from "../core/constants.js";

function langOptions() {
  // "auto" label is localized (data-i18n); the rest are endonyms shown verbatim.
  return (
    `<option value="auto" data-i18n="labels.auto"></option>` +
    LANGS.map((l) => `<option value="${l.code}">${l.flag} ${l.name}</option>`).join("")
  );
}

function modeButtons() {
  return Object.entries(MODES)
    .map(
      ([key]) =>
        `<div class="mode ${key}" data-mode="${key}" data-i18n="modes.${key}.label" data-i18n-title="modes.${key}.title"></div>`
    )
    .join("");
}

/** The medallion + panel markup (no <style>; see buildShadow). */
export const PANEL_MARKUP = `
  <button class="fab" data-i18n-title="fab.title">✝<span class="badge"></span></button>
  <div class="panel">
    <div class="roof"><span class="cross">✝</span><h1 data-i18n="brand.title"></h1><div class="sub" data-i18n="brand.subtitle"></div></div>
    <div class="body">
      <div class="row">
        <button class="ornate reveal" id="reveal" data-i18n="actions.reveal"></button>
        <button class="ornate" id="refresh" data-i18n-title="actions.refresh">↻</button>
      </div>
      <div class="row" id="modeRow"><span class="lbl" data-i18n="labels.mode"></span>
        <div class="modes">${modeButtons()}</div>
      </div>
      <div class="row"><span class="lbl" data-i18n="labels.language"></span>
        <select class="ornate" id="lang">${langOptions()}</select>
        <span class="lbl" data-i18n="labels.threshold"></span>
        <input type="range" id="thr" min="0.35" max="0.75" step="0.01"><span class="val" id="thrv"></span>
      </div>
      <details class="gear">
        <summary data-i18n="oracle.summary"></summary>
        <div id="orIdle">
          <button class="ornate orbtn" id="orEnable" data-i18n="oracle.enable"></button>
          <div class="adv"><input type="text" id="ollamaModel" placeholder="llama3.2:1b"><input type="text" id="ollamaUrl" placeholder="http://localhost:11434"></div>
        </div>
        <div id="orSteps" hidden></div>
        <div id="orActive" hidden><span data-i18n="oracle.activePrefix"></span> <b id="orModel"></b> · <a href="#" id="orDisable" data-i18n="oracle.disable"></a></div>
        <div id="orHelp" hidden></div>
      </details>
      <div class="status" id="status"></div>
    </div>
    <div class="results" id="results"></div>
    <div class="footer">
      <div class="marquee" data-i18n="footer.marquee"></div>
      <div class="counter"><span data-i18n="footer.counter"></span> <b id="counter">0000000</b></div>
    </div>
  </div>`;

/** Attach an open shadow root to `host` and fill it with the styles + markup. */
export function buildShadow(host) {
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${STYLES}</style>${PANEL_MARKUP}`;
  return root;
}
