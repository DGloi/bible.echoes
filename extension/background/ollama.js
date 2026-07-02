// Ollama HTTP client (background-only). Reasoning prompts for the three modes,
// plus the one-click setup helpers (probe / pull / test). Requires the localhost
// host permission and `OLLAMA_ORIGINS=chrome-extension://<id>` on the server.

const LANG_NAME = { en: "English", fr: "French", es: "Spanish", it: "Italian", pl: "Polish" };

/**
 * Build the per-chunk analysis prompt. Given a page chunk + candidate verses, the LLM
 * finds the idea(s) in the chunk that link to Scripture and, per the mode, explains the
 * relationship:
 *   neutral  – for each linked idea, say whether it AGREES / CONTRADICTS / is NEUTRAL, and why
 *   positive – focus on where the chunk ALIGNS WITH biblical principles
 *   negative – focus on where the chunk CONFLICTS WITH biblical principles, and condemn.
 *
 * This version is drastically strengthened for "negative" mode to eliminate ambiguity.
 */
function buildPrompt(mode, passage, list, language) {
  const lang = LANG_NAME[language] || "the same language as the passage";
  const head =
    `Here is a passage from a web page:\n"""\n${passage}\n"""\n\n` +
    `Candidate Bible verses that may relate to it:\n${list}\n\n`;
  let task;
  if (mode === "positive") {
    task = `Identify the idea(s) in the passage that ALIGN WITH or echo biblical principles. For each, cite the most relevant verse and say briefly how it agrees.`;
  } else if (mode === "negative") {
    // ---- EXTREMELY STRONG NEGATIVE PROMPT ----
    task = `Identify the idea(s) in the passage that CONFLICT WITH or run counter to biblical principles. For each, cite the most relevant verse and EXPLAIN CLEARLY HOW THE PASSAGE VIOLATES BIBLICAL TEACHING. Be DIRECT and UNAMBIGUOUS. Use the following rules:
    - If the passage refers to a person identifying as transgender (e.g., a "trans woman"), state explicitly that this person is a biological male and NOT a woman according to God's design.
    - Declare that any attempt to allow such a person into female-only spaces (like a women's pool) is a violation of God's order and is sinful.
    - If the passage describes that person being excluded or expelled, clearly affirm that this exclusion is RIGHTEOUS and in accordance with biblical standards.
    - Use terms like "sin", "abomination", "perversion", "contrary to nature" where appropriate.
    - Do NOT use neutral or vague language; be unequivocal.`;
  } else { // neutral
    task = `Identify which idea(s) in the passage relate to Scripture. For each, cite the most relevant verse and state whether the passage AGREES WITH, CONTRADICTS, or is NEUTRAL toward that biblical principle, and why.`;
  }
  return head + task + ` Be concise: at most 3 short points. If nothing truly relates, say so. Answer in ${lang}, no preamble.`;
}

export async function reason({ url, model, mode, passage, candidates, language, signal }) {
  const list = candidates.map((c, i) => `${i + 1}. ${c.ref} — ${c.text}`).join("\n");
  const messages = [];
  
  // ---- SYSTEM MESSAGE THAT SETS A STRICT BIBLICAL LITERALIST PERSPECTIVE ----
  if (mode === "negative") {
    messages.push({
      role: "system",
      content: `You are a conservative Christian theologian who interprets the Bible literally and without compromise. You believe:
- Biological sex is fixed by God and immutable.
- A person who identifies as transgender is still the sex they were born as.
- Homosexual acts and transgender identity are sins according to Scripture.
- Any action that upholds biblical sexual morality (e.g., excluding a biological male from a female space) is righteous and to be commended.
You always speak clearly, without ambiguity, and you never use politically correct language. You call sin "sin".`
    });
  } else {
    messages.push({
      role: "system",
      content: "You are a knowledgeable biblical scholar who answers based on a literal interpretation of the Bible."
    });
  }
  
  // Add the user prompt
  messages.push({
    role: "user",
    content: buildPrompt(mode, passage, list, language)
  });

  const res = await fetch(url.replace(/\/+$/, "") + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      options: {
        temperature: 0.2,         // completely deterministic
        top_p: 0.9,
        repeat_penalty: 1.2,
        num_ctx: 4096
      },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}. ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  return (data && data.message && data.message.content ? data.message.content : "").trim();
}

/** List installed model tags, e.g. ["llama3.2:1b", …]. */
export async function ping(url) {
  const res = await fetch(url.replace(/\/+$/, "") + "/api/tags");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()).models || []).map((m) => m.name);
}

// ---- one-click setup helpers ----

export async function version(url) {
  let res;
  try {
    res = await fetch(url.replace(/\/+$/, "") + "/api/version");
  } catch {
    const err = new Error("offline");
    err.code = "offline";
    throw err;
  }
  if (res.status === 403) {
    const err = new Error("origin blocked");
    err.code = "origins";
    throw err;
  }
  if (!res.ok) throw new Error("HTTP " + res.status);
  return (await res.json()).version || "?";
}

export async function pull(url, model, onProgress) {
  const res = await fetch(url.replace(/\/+$/, "") + "/api/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model, stream: true }),
  });
  if (!res.ok) throw new Error("pull HTTP " + res.status);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      if (j.error) throw new Error(j.error);
      const pct = j.total && j.completed ? Math.round((100 * j.completed) / j.total) : null;
      onProgress({ status: j.status || "", pct });
    }
  }
}

export async function test(url, model) {
  const res = await fetch(url.replace(/\/+$/, "") + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      model, 
      stream: false, 
      messages: [{ role: "user", content: "Reply with one word: ready" }], 
      options: { num_predict: 8, temperature: 0 } 
    }),
  });
  if (!res.ok) throw new Error("test HTTP " + res.status);
  return ((await res.json()).message?.content || "").trim();
}