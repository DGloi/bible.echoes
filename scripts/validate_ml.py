#!/usr/bin/env python3
"""Mirror the browser multilingual query path; eyeball per-language retrieval."""
import gzip
import json
import os

import numpy as np
from tokenizers import Tokenizer

DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "extension", "data")


def jload(p):
    return json.load(open(os.path.join(DATA, p), encoding="utf-8"))


def gzload(p):
    with gzip.open(os.path.join(DATA, p), "rt", encoding="utf-8") as f:
        return json.load(f)


def bload(p, dt):
    return np.fromfile(os.path.join(DATA, p), dtype=dt)


meta = jload("meta.json")
D = meta["dim"]
tok = Tokenizer.from_file(os.path.join(DATA, "tokenizer.json"))
id_map = bload("id_map_i32.bin", np.int32)
kept = meta["keptCount"]
emb_dq = bload("token_emb_int8.bin", np.int8).astype(np.float32).reshape(kept, D) * bload(
    "token_scales_f32.bin", np.float32
)[:, None]


def embed(text):
    ids = tok.encode(text, add_special_tokens=False).ids
    rows = id_map[np.asarray(ids, dtype=np.int64)]
    rows = rows[rows >= 0]
    if rows.size == 0:
        return None
    v = emb_dq[rows].mean(axis=0)
    n = np.linalg.norm(v)
    return v / n if n else None


LANGS = {l["code"]: l for l in meta["languages"]}
store = {}
for code in LANGS:
    n = LANGS[code]["verses"]
    store[code] = dict(
        v=bload(f"{code}/verse_emb_int8.bin", np.int8).astype(np.float32).reshape(n, D)
        * bload(f"{code}/verse_scales_f32.bin", np.float32)[:, None],
        book=bload(f"{code}/book_u8.bin", np.uint8),
        chap=bload(f"{code}/chapter_u16.bin", np.uint16),
        num=bload(f"{code}/num_u16.bin", np.uint16),
        text=gzload(f"{code}/text.json.gz"),
        books=jload(f"{code}/books.json"),
    )


def search(text, code, k=3):
    e = embed(text)
    if e is None:
        print("  (no tokens)")
        return
    s = store[code]
    sims = s["v"] @ e
    for i in np.argsort(-sims)[:k]:
        print(f"  {sims[i]:.3f}  {s['books'][s['book'][i]]} {s['chap'][i]}:{s['num'][i]}  {s['text'][i][:64]}")


queries = {
    "en": "love your neighbour and forgive those who have wronged you",
    "fr": "aime ton prochain et pardonne à ceux qui t'ont offensé",
    "es": "ama a tu prójimo y perdona a los que te han hecho mal",
    "it": "ama il tuo prossimo e perdona quelli che ti hanno fatto torto",
    "pl": "kochaj swego bliźniego i przebacz tym, którzy cię skrzywdzili",
}
for code, q in queries.items():
    print(f"[{code}] {q}")
    search(q, code)
    print()
