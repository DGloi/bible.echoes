// Toolbar popup — a trusted chrome-extension:// page (never injected into web pages).
// This is the ONLY place the OpenAI API key is entered/stored, so the secret never
// touches a content script. The popup reads/writes settings directly (chrome.storage
// via core/settings.js) and validates the key through the background "openaiTest".

import { getSettings, setSettings } from "./core/settings.js";

const $ = (id) => document.getElementById(id);
const set = (el, text, err) => { el.textContent = text; el.classList.toggle("err", !!err); };
const status = $("status");
const oaStatus = $("oaStatus");

// --- tokenizer self-test ---
$("selfTest").addEventListener("click", async () => {
  set(status, "Loading worker + tokenizer…");
  try {
    const r = await chrome.runtime.sendMessage({ type: "selfTest" });
    if (r && r.ok) set(status, `Tokenizer parity: ${r.pass}/${r.total}` + (r.fails && r.fails.length ? ` (fail: ${r.fails.join(",")})` : " ✓"), r.pass !== r.total);
    else set(status, "Self-test failed: " + ((r && r.error) || "?"), true);
  } catch (e) { set(status, "Error: " + (e.message || e), true); }
});

// --- OpenAI key setup ---
(async () => {
  const s = await getSettings();
  $("oaModel").value = s.openaiModel || "gpt-4o-mini";
  $("oaBase").value = s.openaiBaseUrl || "https://api.openai.com/v1";
  $("oaKey").value = s.openaiApiKey || "";
  if (s.llmEnabled && s.llmProvider === "openai") set(oaStatus, `Enabled · ${s.openaiModel}`);
})();

$("oaSave").addEventListener("click", async () => {
  const apiKey = $("oaKey").value.trim();
  const model = $("oaModel").value.trim() || "gpt-4o-mini";
  const baseUrl = $("oaBase").value.trim() || "https://api.openai.com/v1";
  if (!apiKey) { set(oaStatus, "Enter an API key.", true); return; }
  set(oaStatus, "Testing…");
  let r;
  try { r = await chrome.runtime.sendMessage({ type: "openaiTest", baseUrl, apiKey, model }); }
  catch (e) { set(oaStatus, "Error: " + (e.message || e), true); return; }
  if (r && r.ok) {
    await setSettings({ llmEnabled: true, llmProvider: "openai", openaiApiKey: apiKey, openaiModel: model, openaiBaseUrl: baseUrl });
    set(oaStatus, `Enabled · ${model} ✓`);
  } else {
    set(oaStatus, "Failed: " + ((r && r.error) || "?"), true);
  }
});

$("oaClear").addEventListener("click", async () => {
  $("oaKey").value = "";
  const s = await getSettings();
  await setSettings({ openaiApiKey: "", llmEnabled: s.llmProvider === "openai" ? false : s.llmEnabled });
  set(oaStatus, "Key cleared.");
});
