import os
import json
import hashlib
from typing import Dict, Any, List

import numpy as np
from PIL import Image
from tqdm import tqdm

import pytesseract
import torch
import open_clip
from clip_interrogator import Config, Interrogator

# --- OPTIONAL: hardcode tesseract path ---
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

ROOT = os.path.dirname(os.path.abspath(__file__))

IMAGES_DIR = os.path.join(ROOT, "images")
THUMBS_DIR = os.path.join(ROOT, "thumbs")
EMB_DIR = os.path.join(ROOT, "embeddings")

INDEX_PATH = os.path.join(ROOT, "memes.json")

THUMB_SIZE = 300
OCR_CONFIG = "--oem 3 --psm 6"

CLIP_MODEL = "ViT-L-14"
CLIP_PRETRAINED = "laion2b_s32b_b82k"

# ~20MB bins for Cloudflare safety
MAX_BIN_MB = 20

IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp")


def md5_file(path: str):
    h = hashlib.md5()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def safe_load_index():
    if not os.path.exists(INDEX_PATH):
        return []
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_index(items):
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, separators=(",", ":"))


def make_square_thumb(src_path, dst_path):
    img = Image.open(src_path).convert("RGB")

    w, h = img.size
    m = min(w, h)

    img = img.crop(((w - m) // 2, (h - m) // 2, (w + m) // 2, (h + m) // 2))
    img = img.resize((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)

    img.save(dst_path, "JPEG", quality=80, optimize=True)


def ocr_text(src_path):
    img = Image.open(src_path)
    txt = pytesseract.image_to_string(img, config=OCR_CONFIG)

    txt = txt.replace("\n", " ").lower()
    txt = " ".join(txt.split())

    return txt


def build_clip(device):
    model, _, preprocess = open_clip.create_model_and_transforms(
        CLIP_MODEL, pretrained=CLIP_PRETRAINED
    )

    model.eval()
    model.to(device)

    return model, preprocess


@torch.no_grad()
def image_embedding(model, preprocess, device, src_path):
    img = Image.open(src_path).convert("RGB")

    img_t = preprocess(img).unsqueeze(0).to(device)

    emb = model.encode_image(img_t)

    emb = emb / emb.norm(dim=-1, keepdim=True)

    return emb.squeeze(0).cpu().numpy().astype(np.float32)


def load_existing_embeddings():

    emb_files = sorted(os.listdir(EMB_DIR)) if os.path.exists(EMB_DIR) else []

    embeddings = []

    for f in emb_files:
        if f.endswith(".bin"):
            path = os.path.join(EMB_DIR, f)
            arr = np.fromfile(path, dtype=np.float32)
            embeddings.append(arr)

    if embeddings:
        return np.concatenate(embeddings)

    return np.array([], dtype=np.float32)


def write_embedding_bins(all_embeddings, dim):

    os.makedirs(EMB_DIR, exist_ok=True)

    bin_size = int((MAX_BIN_MB * 1024 * 1024) / (4 * dim))

    start = 0
    i = 0

    while start < len(all_embeddings):

        chunk = all_embeddings[start:start + bin_size]

        path = os.path.join(EMB_DIR, f"emb_{i:03d}.bin")

        chunk.astype(np.float32).tofile(path)

        start += bin_size
        i += 1


def main():

    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(THUMBS_DIR, exist_ok=True)
    os.makedirs(EMB_DIR, exist_ok=True)

    items = safe_load_index()

    seen_hashes = {it["hash"] for it in items}

    seen_files = {it["file"] for it in items}

    image_files = sorted(
        f for f in os.listdir(IMAGES_DIR)
        if f.lower().endswith(IMAGE_EXT)
    )

    new_files = []

    for f in image_files:
        if f"images/{f}" not in seen_files:
            new_files.append(f)

    if not new_files:
        print("No new images detected.")
        return
    
    print(f"{len(new_files)} new images detected")

    device = "cuda" if torch.cuda.is_available() else "cpu"

    print("Using device:", device)

    print("Loading CLIP model...")

    model, preprocess = build_clip(device)

    print("Loading caption model...")
    config = Config(device=device)
    ci = Interrogator(config)

    new_embeddings = []

    processed = 0
    skipped = 0

    for filename in tqdm(new_files, desc="Indexing new memes"):

        path = os.path.join(IMAGES_DIR, filename)

        try:

            h = md5_file(path)

            if h in seen_hashes:

                print("Duplicate detected:", filename)

                skipped += 1
                continue

            thumb_name = os.path.splitext(filename)[0] + ".jpg"

            thumb_path = os.path.join(THUMBS_DIR, thumb_name)

            if not os.path.exists(thumb_path):
                make_square_thumb(path, thumb_path)

            txt = ocr_text(path)

            # generate caption
            with Image.open(path) as im:
                img = im.convert("RGB")
            caption = ci.generate_caption(img).lower()

            emb = image_embedding(model, preprocess, device, path)

            new_embeddings.append(emb)

            item = {
                "file": f"images/{filename}",
                "thumb": f"thumbs/{thumb_name}",
                "text": txt,
                "caption": caption,
                "hash": h
            }

            items.append(item)

            seen_hashes.add(h)

            processed += 1

        except Exception as e:
            print("Error:", filename, e)

    if new_embeddings:

        dim = len(new_embeddings[0])

        existing = load_existing_embeddings()

        if existing.size:
            existing = existing.reshape(-1, dim)
            all_embeddings = np.vstack([existing, new_embeddings])
        else:
            all_embeddings = np.array(new_embeddings)

        write_embedding_bins(all_embeddings, dim)

    save_index(items)

    print(
        f"\nAdded: {processed}, duplicates skipped: {skipped}, total indexed: {len(items)}"
    )


if __name__ == "__main__":
    main()