// Owns the single offscreen document (where the embedding store + tokenizer run,
// since a service worker can't hold WASM/large state reliably) and request/response
// messaging to it.

const OFFSCREEN_URL = "offscreen/offscreen.html";

/** Create the offscreen document if it doesn't already exist (tolerates the race). */
export async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["WORKERS"],
      justification: "On-device multilingual embedding + tokenizer for Bible verse matching.",
    });
  } catch (e) {
    if (!/single offscreen|already/i.test(String(e))) throw e; // tolerate creation race
  }
}

/**
 * Send a message to the offscreen document and await its response. Retries briefly
 * to cover the race where the offscreen module hasn't registered its listener yet.
 */
export async function toOffscreen(msg, tries = 10) {
  for (let i = 0; i < tries; i++) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      if (i === tries - 1 || !/receiving end|establish connection/i.test(String(e))) throw e;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}
