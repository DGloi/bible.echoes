#!/usr/bin/env python3
"""Vendor Transformers.js (tokenizer only) as 3 self-contained local ESM files.

MV3 forbids remote code, and we have no bundler/Node. The jsDelivr `+esm` build is a
self-contained graph of exactly 3 modules; we download them and rewrite the two bare
CDN import paths to relative local paths. The ORT WASM (21 MB) is intentionally NOT
vendored: it is only fetched when an inference session is created, which never happens
for tokenizer-only use.
"""
import os
import re
import urllib.request

VER = "3.7.6"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "extension", "vendor", "transformers")
CDN = "https://cdn.jsdelivr.net"

FILES = {
    "transformers.js": f"/npm/@huggingface/transformers@{VER}/+esm",
    "onnxruntime-common.js": "/npm/onnxruntime-common/+esm",
    "onnxruntime-web.js": "/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/+esm",
}


def get(path):
    return urllib.request.urlopen(
        urllib.request.Request(CDN + path, headers={"User-Agent": "p"}), timeout=180
    ).read().decode("utf-8")


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, path in FILES.items():
        src = get(path)
        # rewrite cross-package CDN imports to local relative files
        src = re.sub(r"/npm/onnxruntime-common/\+esm", "./onnxruntime-common.js", src)
        src = re.sub(r"/npm/onnxruntime-web@[^\"']+/\+esm", "./onnxruntime-web.js", src)
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            f.write(src)
        print(f"  wrote {name} ({len(src):,} chars)")
    print("Done ->", OUT)


if __name__ == "__main__":
    main()
