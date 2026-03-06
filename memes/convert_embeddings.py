import json
import os
import numpy as np

INDEX_PATH = "memes.json"
EMB_DIR = "embeddings"
MAX_BIN_MB = 20

os.makedirs(EMB_DIR, exist_ok=True)

print("Loading existing memes.json...")

with open(INDEX_PATH, "r", encoding="utf-8") as f:
    items = json.load(f)

print("Extracting embeddings...")

embeddings = []
dim = None

for it in items:
    emb = it.pop("emb", None)
    if emb:
        vec = np.array(emb, dtype=np.float32)
        embeddings.append(vec)
        dim = len(vec)

embeddings = np.array(embeddings, dtype=np.float32)

print("Embedding shape:", embeddings.shape)

# split into bins
bin_size = int((MAX_BIN_MB * 1024 * 1024) / (4 * dim))

start = 0
i = 0

while start < len(embeddings):

    chunk = embeddings[start:start+bin_size]

    path = os.path.join(EMB_DIR, f"emb_{i:03d}.bin")

    chunk.astype(np.float32).tofile(path)

    print("Wrote", path)

    start += bin_size
    i += 1

# rewrite JSON without embeddings

with open(INDEX_PATH, "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, separators=(",",":"))

print("memes.json rewritten without embeddings.")
print("Done.")