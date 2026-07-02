#!/usr/bin/env python3
"""
Bible Echo - MULTILINGUAL embedding pipeline (pruned).

Uses minishlab/potion-multilingual-128M (256-dim static, 101 languages) but bundles
only the token rows actually needed by our 5 Bibles + the most frequent tokens (for
query coverage). Verse vectors are computed from the *dequantized pruned* matrix so the
browser query path is identical.

Outputs to extension/data/ :
  meta.json                 dims, kept-token count, language table, tokenizer info
  tokenizer.json            full SentencePiece-Unigram tokenizer (loaded by Transformers.js)
  token_emb_int8.bin        Int8   [kept * 256]  pruned token matrix
  token_scales_f32.bin      Float32[kept]
  id_map_i32.bin            Int32  [maxId+1]      original-token-id -> pruned row, or -1
  <lang>/verse_emb_int8.bin Int8   [nVerses*256]
  <lang>/verse_scales_f32.bin
  <lang>/book_u8.bin, chapter_u16.bin, num_u16.bin
  <lang>/text.json          verse strings
  <lang>/books.json         book names (this translation's language)
  parity_samples.json       {lang, text, ids}[]  tokenizer fixtures for the in-browser self-test

Deps: numpy, tokenizers.  No PyTorch / onnxruntime.
"""
import gzip
import json
import os
import struct
import sys
import tempfile
import urllib.request

import numpy as np

HF_MODEL = "minishlab/potion-multilingual-128M"
HF_BASE = f"https://huggingface.co/{HF_MODEL}/resolve/main"

# (code, display name, getbible abbreviation, year, BibleGateway version code or "")
LANGS = [
    ("en", "English", "kjv", 1611, "KJV"),
    ("fr", "Français", "martin", 1744, ""),
    ("es", "Español", "sse", 1569, ""),
    ("it", "Italiano", "giovanni", 1649, ""),
    ("pl", "Polski", "polgdanska", 1881, ""),
]

TOP_FREQUENT = 90000  # most-frequent tokens kept for query coverage (in addition to Bible tokens)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "extension", "data")
CACHE = os.path.join(tempfile.gettempdir(), "bible-echo-cache")  # outside OneDrive (512MB model)


def log(*a):
    print(*a, flush=True)


def download(url, fname, timeout=600):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, fname)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        log(f"  cached  {fname} ({os.path.getsize(path):,} B)")
        return path
    log(f"  fetch   {fname}  <- {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "bible-echo-build"})
    with urllib.request.urlopen(req, timeout=timeout) as r, open(path, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    log(f"  saved   {fname} ({os.path.getsize(path):,} B)")
    return path


def quantize_rows(mat):
    scales = np.max(np.abs(mat), axis=1) / 127.0
    scales[scales == 0] = 1.0
    q = np.round(mat / scales[:, None]).clip(-127, 127).astype(np.int8)
    return q, scales.astype(np.float32)


def write_bin(path, arr):
    arr.tofile(path)
    log(f"  wrote   {os.path.relpath(path, DATA)} ({os.path.getsize(path):,} B)")


def write_json(path, obj, gz=False):
    if gz:
        with gzip.open(path, "wt", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    else:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    log(f"  wrote   {os.path.relpath(path, DATA)} ({os.path.getsize(path):,} B)")


def main():
    os.makedirs(DATA, exist_ok=True)
    log(f"Bible Echo MULTILINGUAL build -> {DATA}\nModel: {HF_MODEL}\n")

    log("[1/7] Tokenizer")
    tok_path = download(f"{HF_BASE}/tokenizer.json", "tokenizer.json")
    from tokenizers import Tokenizer

    tjson = json.loads(open(tok_path, encoding="utf-8").read())
    # Transformers.js (browser) does not prepend the leading metaspace marker; force the
    # build tokenizer to match so the bundled Bible vectors and browser query vectors are
    # tokenized identically (verified: prepend_scheme="never" => exact parity on all langs).
    if tjson.get("pre_tokenizer", {}).get("type") == "Metaspace":
        tjson["pre_tokenizer"]["prepend_scheme"] = "never"
    tok = Tokenizer.from_str(json.dumps(tjson, ensure_ascii=False))
    vocab_list = tjson["model"]["vocab"]  # [[token, score], ...]
    V = len(vocab_list)
    log(f"  vocab {V}")

    log("\n[2/7] Bibles (getbible) + tokenize")
    bibles = []
    bible_ids = set()
    for code, name, abbr, year, bg in LANGS:
        p = download(f"https://api.getbible.net/v2/{abbr}.json", f"{abbr}.json")
        d = json.loads(open(p, encoding="utf-8").read())
        books = [b["name"] for b in d["books"]]
        bk, ch, vn, txt, ids = [], [], [], [], []
        for bi, b in enumerate(d["books"]):
            for c in b["chapters"]:
                for v in c["verses"]:
                    t = (v.get("text") or "").strip()
                    vi = tok.encode(t, add_special_tokens=False).ids
                    bk.append(bi)
                    ch.append(int(c["chapter"]))
                    vn.append(int(v["verse"]))
                    txt.append(t)
                    ids.append(vi)
                    bible_ids.update(vi)
        bibles.append(dict(code=code, name=name, abbr=abbr, year=year, bg=bg, books=books,
                           bk=bk, ch=ch, vn=vn, txt=txt, ids=ids,
                           translation=d.get("translation") or d.get("distribution_version") or abbr))
        log(f"  {code}: {len(txt)} verses ({d.get('translation', abbr)})")

    log("\n[3/7] Choose kept tokens (Bible tokens + most frequent)")
    scores = np.fromiter((s for _, s in vocab_list), dtype=np.float32, count=V)
    top_freq = set(np.argsort(-scores)[:TOP_FREQUENT].tolist())
    kept = sorted(bible_ids | top_freq)
    kept_arr = np.asarray(kept, dtype=np.int64)
    id_map = np.full(V, -1, dtype=np.int32)
    id_map[kept_arr] = np.arange(len(kept), dtype=np.int32)
    log(f"  bible tokens {len(bible_ids)}, +freq -> kept {len(kept)} / {V} ({100*len(kept)/V:.1f}%)")

    log("\n[4/7] Pull kept rows from model (memmap, no 512MB in RAM)")
    st = download(f"{HF_BASE}/model.safetensors", "model.safetensors")
    with open(st, "rb") as f:
        hlen = struct.unpack("<Q", f.read(8))[0]
        header = json.loads(f.read(hlen))
    info = header["embeddings"]
    assert info["dtype"] == "F32"
    D = info["shape"][1]
    base_off = 8 + hlen + info["data_offsets"][0]
    mm = np.memmap(st, dtype=np.float32, mode="r", offset=base_off, shape=tuple(info["shape"]))
    pruned = np.asarray(mm[kept_arr], dtype=np.float32)  # [kept, D]
    del mm
    log(f"  pruned matrix {pruned.shape}")

    log("\n[5/7] Quantize token matrix")
    tok_q, tok_scales = quantize_rows(pruned)
    emb_dq = tok_q.astype(np.float32) * tok_scales[:, None]  # what the browser will use
    del pruned

    log("\n[6/7] Verse vectors per language (from dequantized pruned matrix)")
    for b in bibles:
        n = len(b["txt"])
        vecs = np.zeros((n, D), dtype=np.float32)
        for i, vi in enumerate(b["ids"]):
            if vi:
                rows = id_map[np.asarray(vi, dtype=np.int64)]  # all >=0 (bible tokens are kept)
                vecs[i] = emb_dq[rows].mean(axis=0)
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        vecs /= norms
        b["vq"], b["vscale"] = quantize_rows(vecs)
        log(f"  {b['code']}: {n} vectors")

    log("\n[7/7] Write assets")
    write_bin(os.path.join(DATA, "token_emb_int8.bin"), tok_q)
    write_bin(os.path.join(DATA, "token_scales_f32.bin"), tok_scales)
    write_bin(os.path.join(DATA, "id_map_i32.bin"), id_map)

    languages = []
    for b in bibles:
        d = os.path.join(DATA, b["code"])
        os.makedirs(d, exist_ok=True)
        write_bin(os.path.join(d, "verse_emb_int8.bin"), b["vq"])
        write_bin(os.path.join(d, "verse_scales_f32.bin"), b["vscale"])
        write_bin(os.path.join(d, "book_u8.bin"), np.asarray(b["bk"], dtype=np.uint8))
        write_bin(os.path.join(d, "chapter_u16.bin"), np.asarray(b["ch"], dtype=np.uint16))
        write_bin(os.path.join(d, "num_u16.bin"), np.asarray(b["vn"], dtype=np.uint16))
        write_json(os.path.join(d, "text.json.gz"), b["txt"], gz=True)
        write_json(os.path.join(d, "books.json"), b["books"])
        languages.append(dict(code=b["code"], name=b["name"], translation=b["translation"],
                              abbr=b["abbr"], year=b["year"], bgVersion=b["bg"], verses=len(b["txt"])))

    # tokenizer.json is consumed by Transformers.js -> must stay plain at a stable path
    write_json(os.path.join(DATA, "tokenizer.json"), tjson)

    samples = []
    for b in bibles[:5]:
        t = b["txt"][len(b["txt"]) // 2]
        samples.append({"lang": b["code"], "text": t, "ids": tok.encode(t, add_special_tokens=False).ids})
    write_json(os.path.join(DATA, "parity_samples.json"), samples)

    write_json(os.path.join(DATA, "meta.json"), {
        "name": "bible-echo",
        "multilingual": True,
        "model": HF_MODEL,
        "dim": int(D),
        "vocabSize": int(V),
        "keptCount": int(len(kept)),
        "quant": "int8-perrow-symmetric",
        "tokenizer": {"type": "unigram-sentencepiece", "file": "tokenizer.json"},
        "languages": languages,
    })

    total = 0
    for root, _, files in os.walk(DATA):
        for f in files:
            total += os.path.getsize(os.path.join(root, f))
    log(f"\nDone. extension/data total: {total/1e6:.1f} MB")


if __name__ == "__main__":
    main()
