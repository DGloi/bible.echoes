// UI for the optional LLM reasoning layer. Owns the whole "⚙ Oracle local" gear
// section: a provider picker (Ollama = local/on-device, OpenAI = cloud), the Ollama
// one-click setup flow (probe → pull → test, over a runtime port to background/
// oracle-setup.js), and the OpenAI key/model/test flow. Persistence goes through the
// injected `save` (a single settings owner in app.js); `onChange` lets the app refresh
// the mode picker / highlights after enable/disable/provider changes.

import { i18n } from "./i18n.js";
import { esc } from "./dom.js";

const OS_LABEL = { win: "Windows", mac: "macOS", linux: "Linux" };

/** Best-effort OS detection to pick the default setup tab. */
function osKey() {
  const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  if (/win/i.test(p)) return "win";
  if (/mac/i.test(p)) return "mac";
  return "linux";
}

/** OS-specific Ollama commands: install, allow-this-extension (persistent), one-off, pull. */
function osCommands(os, origin, model) {
  if (os === "mac")
    return {
      install: "brew install ollama",
      allow: `launchctl setenv OLLAMA_ORIGINS "${origin}"`,
      oneoff: `OLLAMA_ORIGINS="${origin}" ollama serve`,
      pull: `ollama pull ${model}`,
    };
  if (os === "linux")
    return {
      install: "curl -fsSL https://ollama.com/install.sh | sh",
      allow: `sudo systemctl edit ollama\n# add under [Service]:\nEnvironment="OLLAMA_ORIGINS=${origin}"\nsudo systemctl restart ollama`,
      oneoff: `OLLAMA_ORIGINS="${origin}" ollama serve`,
      pull: `ollama pull ${model}`,
    };
  return {
    install: "winget install Ollama.Ollama",
    allow: `setx OLLAMA_ORIGINS "${origin}"`,
    oneoff: `$env:OLLAMA_ORIGINS="${origin}"; ollama serve`,
    pull: `ollama pull ${model}`,
  };
}

/**
 * @param {Object} o
 * @param {ShadowRoot} o.root
 * @param {(patch:object)=>void} o.save         persist + update local settings (app.js)
 * @param {()=>object} o.getSettings            read current settings (app.js state)
 * @param {()=>void} o.onChange                 refresh mode picker / highlights after a change
 */
export function createOracle({ root, save, getSettings, onChange }) {
  const $ = (sel) => root.querySelector(sel);
  const t = (k, p) => i18n.t(k, p);

  // ---- which provider sub-panel is visible, and its active/idle state ----
  function showProvider(p) {
    $("#provOllama").hidden = p !== "ollama";
    $("#provOpenai").hidden = p !== "openai";
    const s = getSettings();
    const active = s.llmEnabled && s.llmProvider === p;
    if (p === "ollama") {
      if (active) { $("#orModel").textContent = s.ollamaModel; showOllama("active"); } else showOllama("idle");
    } else {
      if (active) { $("#oaModelActive").textContent = s.openaiModel; showOpenai("active"); } else showOpenai("setup");
    }
  }
  function showOllama(which) {
    const ids = { idle: "orIdle", steps: "orSteps", active: "orActive", help: "orHelp" };
    for (const [k, id] of Object.entries(ids)) { const n = $("#" + id); if (n) n.hidden = k !== which; }
  }
  function showOpenai(which) {
    $("#oaSetup").hidden = which !== "setup";
    $("#oaActive").hidden = which !== "active";
  }
  // The OpenAI API key is entered in the toolbar popup (a trusted extension page),
  // never here — this content-script UI must not hold the secret. This panel only
  // shows the cloud provider's active/disable state; see popup.js for key setup.

  // ---- Ollama (local) one-click flow, over the be-ollama-setup port ----
  function start() {
    showOllama("steps");
    const box = $("#orSteps");
    box.innerHTML = "";
    const rows = {};
    const row = (key) => {
      if (rows[key]) return rows[key];
      const d = document.createElement("div");
      d.className = "ostep run";
      d.innerHTML = `<span class="ic"></span><span class="tx">${t("oracle.steps." + key)}</span><span class="pc"></span>`;
      box.appendChild(d);
      rows[key] = d;
      return d;
    };
    let bar;
    let port;
    try {
      port = chrome.runtime.connect({ name: "be-ollama-setup" });
    } catch {
      showOllama("help");
      renderHelp("install");
      return;
    }
    port.onMessage.addListener((m) => {
      if (m.step === "done") {
        save({ llmEnabled: true, llmProvider: "ollama", ollamaModel: m.model || $("#ollamaModel").value.trim(), ollamaUrl: $("#ollamaUrl").value.trim() });
        $("#orModel").textContent = m.model || "";
        showOllama("active");
        onChange();
        return;
      }
      if (m.step === "ping" && m.state === "fail") { showOllama("help"); renderHelp(m.help, m.id); return; }
      if (m.step === "error") {
        const r = row("test");
        r.className = "ostep fail";
        r.querySelector(".tx").textContent = t("status.error") + (m.text || "?");
        addRetry(box);
        return;
      }
      const r = row(m.step);
      r.className = "ostep " + (m.state || "run");
      const base = t("oracle.steps." + m.step);
      const detail = m.step === "model" && m.state === "ok" ? t("oracle.present") : m.text;
      if (detail) r.querySelector(".tx").textContent = base + " — " + detail;
      if (m.step === "pull") {
        if (!bar) { bar = document.createElement("div"); bar.className = "bar"; bar.innerHTML = "<i></i>"; r.after(bar); }
        if (typeof m.pct === "number") { bar.firstChild.style.width = m.pct + "%"; r.querySelector(".pc").textContent = m.pct + "%"; }
      }
    });
    port.postMessage({
      action: "start",
      url: $("#ollamaUrl").value.trim() || "http://localhost:11434",
      model: $("#ollamaModel").value.trim() || "llama3.2:1b",
    });
  }
  function addRetry(box) {
    const b = document.createElement("button");
    b.className = "ornate";
    b.style.cssText = "margin-top:6px;font-size:12px";
    b.textContent = t("oracle.retry");
    b.addEventListener("click", start);
    box.appendChild(b);
  }

  // OS-tabbed setup guide (Ollama not reachable / blocking this extension).
  function renderHelp(kind, id) {
    const origin = "chrome-extension://" + (id || (chrome.runtime && chrome.runtime.id) || "<id>");
    const model = $("#ollamaModel").value.trim() || "llama3.2:1b";
    const help = $("#orHelp");
    const showInstall = kind !== "origins";
    const section = (os) => {
      const c = osCommands(os, origin, model);
      let step = 0;
      const num = () => `<b>${++step}.</b> `;
      const parts = [];
      if (showInstall)
        parts.push(`${num()}${t("oracle.help.install")} <a href="https://ollama.com/download" target="_blank" rel="noopener">ollama.com</a><code>${esc(c.install)}</code>`);
      parts.push(
        `${num()}${t("oracle.help.allow")}<code>${esc(c.allow)}</code>` +
          `<div class="dim">${t("oracle.help.restart")} · ${t("oracle.help.oneoff")}<code>${esc(c.oneoff)}</code></div>`
      );
      parts.push(`${num()}${t("oracle.help.download")}<code>${esc(c.pull)}</code><div class="warn">${t("oracle.help.size")}</div>`);
      return parts.join("");
    };
    const os0 = osKey();
    help.innerHTML =
      `<div class="intro">${t(kind === "origins" ? "oracle.help.blocked" : "oracle.help.notDetected")}</div>` +
      `<div class="ostabs">${Object.keys(OS_LABEL).map((os) => `<span class="ostab${os === os0 ? " on" : ""}" data-os="${os}">${OS_LABEL[os]}</span>`).join("")}</div>` +
      `<div class="osbody">${section(os0)}</div>` +
      `<a href="#" id="orRetry">${t("oracle.retry")}</a>`;
    help.querySelectorAll(".ostab").forEach((tab) =>
      tab.addEventListener("click", () => {
        help.querySelectorAll(".ostab").forEach((x) => x.classList.toggle("on", x === tab));
        help.querySelector(".osbody").innerHTML = section(tab.dataset.os);
      })
    );
    help.querySelector("#orRetry").addEventListener("click", (e) => { e.preventDefault(); start(); });
  }

  // ---- init: fill fields, wire events, show the active provider ----
  const s0 = getSettings();
  $("#llmProvider").value = s0.llmProvider || "ollama";
  $("#ollamaModel").value = s0.ollamaModel || "llama3.2:1b";
  $("#ollamaUrl").value = s0.ollamaUrl || "http://localhost:11434";

  $("#llmProvider").addEventListener("change", () => {
    const p = $("#llmProvider").value;
    save({ llmProvider: p, llmEnabled: false }); // switching provider requires re-enabling
    onChange();
    showProvider(p);
  });
  $("#ollamaModel").addEventListener("change", () => save({ ollamaModel: $("#ollamaModel").value.trim() }));
  $("#ollamaUrl").addEventListener("change", () => save({ ollamaUrl: $("#ollamaUrl").value.trim() }));
  $("#orEnable").addEventListener("click", start);
  $("#orDisable").addEventListener("click", (e) => { e.preventDefault(); save({ llmEnabled: false }); showOllama("idle"); onChange(); });
  $("#oaDisable").addEventListener("click", (e) => { e.preventDefault(); save({ llmEnabled: false }); showOpenai("setup"); onChange(); });

  showProvider(s0.llmProvider || "ollama");
}
