// OpenAI (and OpenAI-compatible) chat-completions client for the optional cloud LLM
// provider (background-only). Requires the https://api.openai.com/* host permission
// (or the host of a custom openaiBaseUrl). NOTE: unlike the Ollama path, this sends the
// analyzed page passages to a third party — the UI warns the user before enabling.
//
// This module intentionally uses a neutral critique prompt (agree / contradict / neutral,
// citing verses). It does not target people by any protected characteristic.

const LANG_NAME = { en: "English", fr: "French", es: "Spanish", it: "Italian", pl: "Polish" };

function buildPrompt(mode, passage, list, language) {
  const lang = LANG_NAME[language] || "the same language as the passage";
  const head =
    `Here is a passage from a web page:\n"""\n${passage}\n"""\n\n` +
    `Candidate Bible verses that may relate to it:\n${list}\n\n`;
  const task =
    mode === "positive"
      ? `Identify the idea(s) in the passage that ALIGN WITH or echo biblical principles. For each, cite the most relevant verse and say briefly how it agrees.`
      : mode === "negative"
      ? `Identify the idea(s) in the passage that CONFLICT WITH or run counter to biblical principles. For each, cite the most relevant verse and say briefly how it clashes. Be critical but fair.`
      : `Identify which idea(s) in the passage relate to Scripture. For each, cite the most relevant verse and state whether the passage AGREES WITH, CONTRADICTS, or is NEUTRAL toward that biblical principle, and why.`;
  return head + task + ` Be concise: at most 3 short points. If nothing truly relates, say so. Answer in ${lang}, no preamble.`;
}

const chatUrl = (baseUrl) => baseUrl.replace(/\/+$/, "") + "/chat/completions";

export async function reason({ baseUrl, apiKey, model, mode, passage, candidates, language, signal }) {
  const list = candidates.map((c, i) => `${i + 1}. ${c.ref} — ${c.text}`).join("\n");
  const res = await fetch(chatUrl(baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a knowledgeable biblical scholar. Answer based on the text of the Bible." },
        { role: "user", content: buildPrompt(mode, passage, list, language) },
      ],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}. ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
}

/** Validate the key + model with a 1-token request. Throws on failure. */
export async function test({ baseUrl, apiKey, model }) {
  const res = await fetch(chatUrl(baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}. ${(await res.text().catch(() => "")).slice(0, 160)}`);
  return true;
}
