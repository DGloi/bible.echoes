// Builds the shadow-DOM markup for the medallion + panel. Text is NOT inlined:
// every label carries a data-i18n / data-i18n-title attribute that i18n.localize()
// fills from the active locale, so the panel re-localizes on language change without
// being rebuilt. Structural data (languages, modes) comes from core/constants.js.

import { STYLES } from "./styles.js";
import { LANGS, MODES, DONATE_URL } from "../core/constants.js";

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
        <div class="row" style="margin-top:6px">
          <span class="lbl" data-i18n="oracle.provider"></span>
          <select class="ornate" id="llmProvider">
            <option value="ollama" data-i18n="oracle.provOllama"></option>
            <option value="openai" data-i18n="oracle.provOpenai"></option>
          </select>
        </div>
        <div id="provOllama">
          <div id="orIdle">
            <button class="ornate orbtn" id="orEnable" data-i18n="oracle.enable"></button>
            <div class="adv"><input type="text" id="ollamaModel" placeholder="llama3.2:1b"><input type="text" id="ollamaUrl" placeholder="http://localhost:11434"></div>
          </div>
          <div id="orSteps" hidden></div>
          <div id="orActive" hidden><span data-i18n="oracle.activePrefix"></span> <b id="orModel"></b> · <a href="#" id="orDisable" data-i18n="oracle.disable"></a></div>
          <div id="orHelp" hidden></div>
        </div>
        <div id="provOpenai" hidden>
          <div id="oaSetup">
            <div class="dim" data-i18n="oracle.openaiPopup"></div>
            <div class="warn" data-i18n="oracle.cloudWarn"></div>
          </div>
          <div id="oaActive" hidden><span data-i18n="oracle.activePrefix"></span> <b id="oaModelActive"></b> · <a href="#" id="oaDisable" data-i18n="oracle.disable"></a></div>
        </div>
      </details>
      <div class="status" id="status"></div>
    </div>
    <div class="support" id="supportPrompt" hidden>
      <span data-i18n="support.enjoy"></span>
      <a class="coffee" id="supportCoffee" href="${DONATE_URL}" target="_blank" rel="noopener" data-i18n="support.coffee"></a>
      <button class="sx" id="supportClose" title="×">✕</button>
    </div>
    <div class="results" id="results"></div>
    <div class="footer">
      <div class="marquee" data-i18n="footer.marquee"></div>
      <div class="donate-row"><a class="donate" href="${DONATE_URL}" target="_blank" rel="noopener" data-i18n="footer.donate"></a></div>
      <div class="counter"><span data-i18n="footer.counter"></span> <b id="counter">0000000</b></div>
    </div>
  </div>`;

// @font-face for the bundled MedievalSharp (OFL) display font. Injected here (not in
// styles.js) because the woff2 URLs must be resolved with chrome.runtime.getURL, and the
// files are declared in web_accessible_resources. Two subsets cover Latin + Latin-ext
// (French accents, Polish diacritics). unicode-range values are Fontsource's defaults.
function fontFaces() {
  const u = (f) => chrome.runtime.getURL("assets/fonts/" + f);
  return (
    `@font-face{font-family:'MedievalSharp';font-style:normal;font-weight:400;font-display:swap;` +
    `src:url('${u("medievalsharp-latin-400-normal.woff2")}') format('woff2');` +
    `unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}` +
    `@font-face{font-family:'MedievalSharp';font-style:normal;font-weight:400;font-display:swap;` +
    `src:url('${u("medievalsharp-latin-ext-400-normal.woff2")}') format('woff2');` +
    `unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}`
  );
}

/** Attach an open shadow root to `host` and fill it with the fonts + styles + markup. */
export function buildShadow(host) {
  // "closed": host.shadowRoot is null to page scripts, so a web page can't read the
  // panel's DOM (defense-in-depth; secrets are kept out of this context regardless).
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>${fontFaces()}${STYLES}</style>${PANEL_MARKUP}`;
  return root;
}
