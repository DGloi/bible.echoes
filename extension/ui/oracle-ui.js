// UI for the optional one-click local-LLM setup. Opens a port to the background
// worker, which probes Ollama → pulls the model (streamed progress) → tests it →
// enables it. This module only renders the step list / progress / help; the actual
// work happens in background/oracle-setup.js.

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

/**
 * OS-specific Ollama commands. `allow` sets OLLAMA_ORIGINS persistently for the way
 * Ollama actually runs on that OS (tray app / launchd / systemd); `oneoff` is the
 * quick single-session alternative; `pull` downloads the model.
 */
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
 * @param {ShadowRoot} o.root        the panel's shadow root (contains #orIdle, #orSteps, …)
 * @param {(model:string) => void} o.onEnabled  called when setup succeeds and the LLM is on
 * @returns {{ show(which:'idle'|'steps'|'active'|'help'): void, setActive(model:string): void, start(): void }}
 */
export function createOracle({ root, onEnabled }) {
  const $ = (sel) => root.querySelector(sel);
  const t = (k, p) => i18n.t(k, p);

  /** Toggle which of the four oracle sub-sections is visible. */
  function show(which) {
    const ids = { idle: "orIdle", steps: "orSteps", active: "orActive", help: "orHelp" };
    for (const [key, id] of Object.entries(ids)) {
      const node = $("#" + id);
      if (node) node.hidden = key !== which;
    }
  }

  /** Switch to the "active" state showing the running model. */
  function setActive(model) {
    $("#orModel").textContent = model || "";
    show("active");
  }

  // OS-tabbed setup guide. `kind === "origins"` means Ollama is reachable but blocking
  // this extension (skip the install step); otherwise it's not running (show all steps).
  function renderHelp(kind, id) {
    const origin = "chrome-extension://" + (id || (chrome.runtime && chrome.runtime.id) || "<id>");
    const model = ($("#ollamaModel").value || "").trim() || "llama3.2:1b";
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
    help.querySelector("#orRetry").addEventListener("click", (e) => {
      e.preventDefault();
      start();
    });
  }

  function start() {
    show("steps");
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
      show("help");
      renderHelp("install");
      return;
    }
    port.onMessage.addListener((m) => {
      if (m.step === "done") {
        setActive(m.model);
        onEnabled(m.model);
        return;
      }
      if (m.step === "ping" && m.state === "fail") {
        show("help");
        renderHelp(m.help, m.id);
        return;
      }
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
      // model already present → localized note; otherwise show Ollama's own status text
      const detail = m.step === "model" && m.state === "ok" ? t("oracle.present") : m.text;
      if (detail) r.querySelector(".tx").textContent = base + " — " + detail;
      if (m.step === "pull") {
        if (!bar) {
          bar = document.createElement("div");
          bar.className = "bar";
          bar.innerHTML = "<i></i>";
          r.after(bar);
        }
        if (typeof m.pct === "number") {
          bar.firstChild.style.width = m.pct + "%";
          r.querySelector(".pc").textContent = m.pct + "%";
        }
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

  return { show, setActive, start };
}
