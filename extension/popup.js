const status = document.getElementById("status");
const set = (t, err) => { status.textContent = t; status.classList.toggle("err", !!err); };

document.getElementById("selfTest").addEventListener("click", async () => {
  set("Loading worker + tokenizer…");
  try {
    const r = await chrome.runtime.sendMessage({ type: "selfTest" });
    if (r && r.ok) set(`Tokenizer parity: ${r.pass}/${r.total}` + (r.fails && r.fails.length ? ` (fail: ${r.fails.join(",")})` : " ✓"), r.pass !== r.total);
    else set("Self-test failed: " + ((r && r.error) || "?"), true);
  } catch (e) { set("Error: " + (e.message || e), true); }
});
