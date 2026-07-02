// Multilingual store: SentencePiece tokenizer (Transformers.js) + pruned static token
// matrix + per-language verse vectors. Runs in the offscreen document (page context).
// Mirrors scripts/validate_ml.py exactly. No WASM, no inference session — tokenizer only.

import { env, AutoTokenizer } from "../vendor/transformers/transformers.js";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = false;
env.localModelPath = chrome.runtime.getURL(""); // => fetches data/tokenizer.json etc.

const url = (p) => chrome.runtime.getURL("data/" + p);
const fetchJSON = async (p) => (await fetch(url(p))).json();
const fetchBin = async (p) => (await fetch(url(p))).arrayBuffer();
async function fetchGzJSON(p) {
  const res = await fetch(url(p));
  const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

let _base = null;
const _langs = new Map();

async function loadBase() {
  const meta = await fetchJSON("meta.json");
  const [tokenizer, idMap, tokI8, tokScale, englishBooks] = await Promise.all([
    AutoTokenizer.from_pretrained("data"),
    fetchBin("id_map_i32.bin").then((b) => new Int32Array(b)),
    fetchBin("token_emb_int8.bin").then((b) => new Int8Array(b)),
    fetchBin("token_scales_f32.bin").then((b) => new Float32Array(b)),
    fetchJSON("en/books.json"), // canonical English names for chapter links
  ]);
  const langMeta = {};
  for (const l of meta.languages) langMeta[l.code] = l;
  return { meta, D: meta.dim, tokenizer, idMap, tokI8, tokScale, englishBooks, langMeta };
}
export function ready() {
  if (!_base) _base = loadBase();
  return _base;
}

async function loadLang(code) {
  const B = await ready();
  const n = B.langMeta[code].verses;
  const [vI8, vScale, book, chap, num, text, books] = await Promise.all([
    fetchBin(`${code}/verse_emb_int8.bin`).then((b) => new Int8Array(b)),
    fetchBin(`${code}/verse_scales_f32.bin`).then((b) => new Float32Array(b)),
    fetchBin(`${code}/book_u8.bin`).then((b) => new Uint8Array(b)),
    fetchBin(`${code}/chapter_u16.bin`).then((b) => new Uint16Array(b)),
    fetchBin(`${code}/num_u16.bin`).then((b) => new Uint16Array(b)),
    fetchGzJSON(`${code}/text.json.gz`),
    fetchJSON(`${code}/books.json`),
  ]);
  return { n, vI8, vScale, book, chap, num, text, books };
}
function ensureLang(code) {
  if (!_langs.has(code)) _langs.set(code, loadLang(code));
  return _langs.get(code);
}

function encodeIds(tokenizer, text) {
  const r = tokenizer.encode(text, { add_special_tokens: false });
  return Array.isArray(r) ? r : Array.from((r.input_ids && (r.input_ids.data || r.input_ids)) || []);
}

async function embedQuery(text) {
  const B = await ready();
  const D = B.D;
  const ids = encodeIds(B.tokenizer, text);
  const acc = new Float32Array(D);
  let n = 0;
  for (const id of ids) {
    const row = B.idMap[id];
    if (row < 0) continue; // token pruned out (rare/foreign) -> skip
    const off = row * D;
    const sc = B.tokScale[row];
    for (let d = 0; d < D; d++) acc[d] += B.tokI8[off + d] * sc;
    n++;
  }
  if (n === 0) return null;
  let norm = 0;
  for (let d = 0; d < D; d++) {
    acc[d] /= n;
    norm += acc[d] * acc[d];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return null;
  for (let d = 0; d < D; d++) acc[d] /= norm;
  return acc;
}

function chapterUrl(B, bookIdx, chapter) {
  const en = B.englishBooks[bookIdx] || "";
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(en + " " + chapter)}&version=KJV`;
}

async function searchVec(q, code, k, minScore) {
  const B = await ready();
  const L = await ensureLang(code);
  const D = B.D;
  const N = L.n;
  const top = [];
  for (let i = 0; i < N; i++) {
    let s = 0;
    const off = i * D;
    for (let d = 0; d < D; d++) s += q[d] * L.vI8[off + d];
    s *= L.vScale[i];
    if (s < minScore) continue;
    if (top.length < k) {
      top.push({ i, score: s });
      top.sort((a, b) => a.score - b.score);
    } else if (s > top[0].score) {
      top[0] = { i, score: s };
      top.sort((a, b) => a.score - b.score);
    }
  }
  top.sort((a, b) => b.score - a.score);
  return top.map((t) => {
    const bi = L.book[t.i];
    return {
      score: t.score,
      ref: `${L.books[bi]} ${L.chap[t.i]}:${L.num[t.i]}`,
      book: L.books[bi],
      chapter: L.chap[t.i],
      verse: L.num[t.i],
      text: L.text[t.i],
      chapterUrl: chapterUrl(B, bi, L.chap[t.i]),
    };
  });
}

/** Analyze a list of page passages against one language's verses. */
export async function analyzePassages(passages, code, { minScore, maxPassages, maxResults }) {
  const total = passages.length;
  const slice = passages.slice(0, maxPassages);
  const results = [];
  for (let i = 0; i < slice.length; i++) {
    const q = await embedQuery(slice[i]);
    if (!q) continue;
    const hits = await searchVec(q, code, 3, minScore);
    if (hits.length) results.push({ i, hits });
  }
  results.sort((a, b) => b.hits[0].score - a.hits[0].score);
  return { results: results.slice(0, maxResults), analyzed: slice.length, total, truncated: total > slice.length };
}

/** Dev parity check used by the popup self-test. */
export async function selfTest() {
  const B = await ready();
  const samples = await fetchJSON("parity_samples.json");
  let pass = 0;
  const fails = [];
  for (const s of samples) {
    const got = encodeIds(B.tokenizer, s.text);
    const ok = got.length === s.ids.length && got.every((v, i) => v === s.ids[i]);
    ok ? pass++ : fails.push(s.lang);
  }
  return { pass, total: samples.length, fails };
}
