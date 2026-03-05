import os
import json
import hashlib
import shutil
from typing import Dict, Any, List

import numpy as np
from PIL import Image
from tqdm import tqdm

import open_clip
from clip_interrogator import Config, Interrogator

import pytesseract

# --- OPTIONAL: hardcode tesseract path (recommended on Windows) ---
# If your PATH works, you can comment this out.
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

import torch
import open_clip



ROOT = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(ROOT, "images")
INCOMING_DIR = os.path.join(ROOT, "incoming")
THUMBS_DIR = os.path.join(ROOT, "thumbs")
INDEX_PATH = os.path.join(ROOT, "memes.json")

THUMB_SIZE = 300  # 300x300 squares
OCR_CONFIG = "--oem 3 --psm 6"

# CLIP model choice: good balance of quality/speed
CLIP_MODEL = "ViT-L-14"
CLIP_PRETRAINED = "laion2b_s32b_b82k"

# Store embeddings as float32 lists (smaller). Optionally round to save JSON size.
ROUND_EMBEDDINGS_DECIMALS = 6  # set None to disable rounding


def md5_file(path: str, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def safe_load_index() -> List[Dict[str, Any]]:
    if not os.path.exists(INDEX_PATH):
        return []
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Backwards-compatible: if old list exists, keep it
    if isinstance(data, list):
        return data
    raise ValueError("memes.json exists but is not a list")


def save_index(items: List[Dict[str, Any]]) -> None:
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False)


def make_square_thumb(src_path: str, dst_path: str) -> None:
    img = Image.open(src_path).convert("RGB")
    w, h = img.size
    min_dim = min(w, h)
    left = (w - min_dim) // 2
    top = (h - min_dim) // 2
    img = img.crop((left, top, left + min_dim, top + min_dim))
    img = img.resize((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
    img.save(dst_path, "JPEG", quality=80, optimize=True, progressive=True)


def ocr_text(src_path: str) -> str:
    img = Image.open(src_path)
    txt = pytesseract.image_to_string(img, config=OCR_CONFIG)
    # normalize
    txt = txt.replace("\n", " ").strip().lower()
    # collapse whitespace
    txt = " ".join(txt.split())
    return txt


def build_clip(device: str):
    model, _, preprocess = open_clip.create_model_and_transforms(
        CLIP_MODEL, pretrained=CLIP_PRETRAINED
    )
    model.eval()
    model.to(device)
    tokenizer = open_clip.get_tokenizer(CLIP_MODEL)
    return model, preprocess, tokenizer


@torch.no_grad()
def image_embedding(model, preprocess, device: str, src_path: str) -> np.ndarray:
    img = Image.open(src_path).convert("RGB")
    img_t = preprocess(img).unsqueeze(0).to(device)
    emb = model.encode_image(img_t)
    emb = emb / emb.norm(dim=-1, keepdim=True)  # normalize for cosine=dot
    emb = emb.squeeze(0).detach().cpu().numpy().astype(np.float32)
    if ROUND_EMBEDDINGS_DECIMALS is not None:
        emb = np.round(emb, ROUND_EMBEDDINGS_DECIMALS)
    return emb


def main():
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(INCOMING_DIR, exist_ok=True)
    os.makedirs(THUMBS_DIR, exist_ok=True)

    # load existing index
    items = safe_load_index()

    # Build lookup by hash and by filename
    seen_hashes = set()
    seen_files = set()
    for it in items:
        if "hash" in it:
            seen_hashes.add(it["hash"])
        if "file" in it:
            seen_files.add(it["file"])

    # collect incoming files
    incoming_files = [
        f for f in os.listdir(INCOMING_DIR)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    ]

    if not incoming_files:
        print("No new files found in incoming/. Nothing to do.")
        return

    # choose device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")
    print("Loading CLIP model...")
    model, preprocess, tokenizer = build_clip(device)
    
    print("Loading caption model...")
    config = Config(device=device)
    ci = Interrogator(config)

    processed = 0
    skipped = 0

    for filename in tqdm(incoming_files, desc="Indexing new memes"):
        src_incoming = os.path.join(INCOMING_DIR, filename)

        try:
            h = md5_file(src_incoming)

            if h in seen_hashes:
                # duplicate content
                skipped += 1
                # Move to images anyway? Safer to move into a duplicates folder; for now, just delete.
                # If you prefer to keep it, comment out the delete.
                os.remove(src_incoming)
                continue

            # Move into images/ (keep original filename)
            dst_image = os.path.join(IMAGES_DIR, filename)
            # If a file with same name exists, avoid overwrite by adding suffix
            if os.path.exists(dst_image):
                base, ext = os.path.splitext(filename)
                i = 2
                while True:
                    candidate = f"{base} ({i}){ext}"
                    candidate_path = os.path.join(IMAGES_DIR, candidate)
                    if not os.path.exists(candidate_path):
                        filename = candidate
                        dst_image = candidate_path
                        break
                    i += 1

            shutil.move(src_incoming, dst_image)

            # Create thumb (always jpg for speed/consistency)
            thumb_name = os.path.splitext(filename)[0] + ".jpg"
            dst_thumb = os.path.join(THUMBS_DIR, thumb_name)
            make_square_thumb(dst_image, dst_thumb)

            # OCR
            txt = ocr_text(dst_image)

            # CLIP embedding
            emb = image_embedding(model, preprocess, device, dst_image)

            # CLIP interrogator caption
            img = Image.open(dst_image).convert("RGB")
            caption = ci.generate_caption(img).lower()

            item = {
                "file": f"images/{filename}",
                "thumb": f"thumbs/{thumb_name}",
                "text": txt,
                "caption": caption,
                "hash": h,
                "emb": emb.tolist(),
            }
            items.append(item)
            seen_hashes.add(h)
            seen_files.add(item["file"])
            processed += 1

        except Exception as e:
            print(f"\nError processing {filename}: {e}\n")
            # If something went wrong after move, you may want to move it back to incoming or leave it in images.
            continue

    save_index(items)
    print(f"Done. Added: {processed}, skipped duplicates: {skipped}, total indexed: {len(items)}")
    print("memes.json updated.")


if __name__ == "__main__":
    main()