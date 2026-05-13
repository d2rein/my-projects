import argparse
import gc
import hashlib
import json
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

import numpy as np
import open_clip
import pytesseract
import torch
from PIL import Image
from tqdm import tqdm
from transformers import BlipForConditionalGeneration, BlipProcessor


TESSERACT_EXE = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
pytesseract.pytesseract.tesseract_cmd = TESSERACT_EXE


ROOT = Path(__file__).resolve().parent
IMMICH_ROOT = Path(r"C:\Users\d2rei\Documents\immich\library\library\admin")

IMAGES_DIR = ROOT / "images"
THUMBS_DIR = ROOT / "thumbs"
EMB_DIR = ROOT / "embeddings"
INDEX_PATH = ROOT / "memes.json"
STATE_PATH = ROOT / "import_state.json"
STATUS_PATH = ROOT / "sync_status.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
DEFAULT_SCAN_FROM = datetime(2026, 1, 1)

THUMB_SIZE = 300
OCR_CONFIG = "--oem 3 --psm 6"
PROCESSING_MAX_DIMENSION = 2200

CLIP_MODEL = "ViT-L-14"
CLIP_PRETRAINED = "laion2b_s32b_b82k"
CAPTION_MODEL_NAME = "Salesforce/blip-image-captioning-base"
MAX_BIN_MB = 20


def log(message: str) -> None:
    print(message, flush=True)


def save_json(path: Path, data) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))


def load_json(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def save_status(**kwargs) -> None:
    payload = {"updated_at": datetime.now().isoformat(timespec="seconds")}
    payload.update(kwargs)
    save_json(STATUS_PATH, payload)


def md5_file(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def build_clip(device: str):
    model, _, preprocess = open_clip.create_model_and_transforms(
        CLIP_MODEL,
        pretrained=CLIP_PRETRAINED,
    )
    model.eval()
    model.to(device)
    return model, preprocess


def build_captioner(device: str):
    processor = BlipProcessor.from_pretrained(CAPTION_MODEL_NAME)
    model = BlipForConditionalGeneration.from_pretrained(CAPTION_MODEL_NAME)
    model.to(device)
    model.eval()
    return processor, model


def load_processing_rgb(src_path: Path, max_dimension: int = PROCESSING_MAX_DIMENSION) -> Image.Image:
    with Image.open(src_path) as opened:
        rgb = opened.convert("RGB")
        width, height = rgb.size
        longest = max(width, height)
        if longest > max_dimension:
            scale = max_dimension / longest
            rgb = rgb.resize(
                (max(1, int(width * scale)), max(1, int(height * scale))),
                Image.LANCZOS,
            )
        return rgb


@torch.no_grad()
def image_embedding(model, preprocess, device: str, src_path: Path) -> np.ndarray:
    rgb = load_processing_rgb(src_path)
    tensor = preprocess(rgb).unsqueeze(0).to(device)
    emb = model.encode_image(tensor)
    emb = emb / emb.norm(dim=-1, keepdim=True)
    return emb.squeeze(0).cpu().numpy().astype(np.float32)


@torch.no_grad()
def image_caption(processor, model, device: str, src_path: Path) -> str:
    rgb = load_processing_rgb(src_path)
    inputs = processor(images=rgb, return_tensors="pt")
    inputs = {key: value.to(device) for key, value in inputs.items()}
    output = model.generate(**inputs, max_new_tokens=30)
    caption = processor.decode(output[0], skip_special_tokens=True).strip().lower()
    del inputs
    del output
    return caption


def make_square_thumb(src_path: Path, dst_path: Path) -> None:
    with Image.open(src_path) as opened:
        img = opened.convert("RGB")
        width, height = img.size
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        img = img.crop((left, top, left + side, top + side))
        img = img.resize((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
        img.save(dst_path, "JPEG", quality=80, optimize=True, progressive=True)


def ocr_text(src_path: Path) -> str:
    last_error = None
    for max_dimension in (1800, 1400, 1000, 700):
        try:
            rgb = load_processing_rgb(src_path, max_dimension=max_dimension)
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                tmp_path = Path(tmp.name)

            try:
                rgb.save(tmp_path, "JPEG", quality=85, optimize=True)
                result = subprocess.run(
                    [
                        TESSERACT_EXE,
                        str(tmp_path),
                        "stdout",
                        "--oem",
                        "3",
                        "--psm",
                        "6",
                    ],
                    capture_output=True,
                    check=True,
                )
                text = result.stdout.decode("utf-8", errors="replace")
            finally:
                tmp_path.unlink(missing_ok=True)

            text = text.replace("\n", " ").lower()
            return " ".join(text.split())
        except Exception as exc:
            last_error = exc
            gc.collect()

    if last_error:
        raise last_error

    return ""


def load_existing_embeddings():
    arrays = []
    for path in sorted(EMB_DIR.glob("*.bin")):
        arrays.append(np.fromfile(path, dtype=np.float32))

    if arrays:
        return np.concatenate(arrays)

    return np.array([], dtype=np.float32)


def write_embedding_bins(all_embeddings: np.ndarray, dim: int) -> None:
    for path in EMB_DIR.glob("*.bin"):
        path.unlink()

    rows_per_bin = max(1, int((MAX_BIN_MB * 1024 * 1024) / (4 * dim)))

    start = 0
    index = 0
    while start < len(all_embeddings):
        chunk = all_embeddings[start:start + rows_per_bin]
        (EMB_DIR / f"emb_{index:03d}.bin").write_bytes(chunk.astype(np.float32).tobytes())
        start += rows_per_bin
        index += 1


def load_items():
    return load_json(INDEX_PATH, [])


def load_state():
    return load_json(
        STATE_PATH,
        {
            "last_successful_scan": None,
        },
    )


def save_state(state: dict) -> None:
    save_json(STATE_PATH, state)


def resolve_scan_from(cli_since: str | None) -> datetime:
    if cli_since:
        return datetime.fromisoformat(cli_since)

    state = load_state()
    previous = state.get("last_successful_scan")
    if previous:
        return datetime.fromisoformat(previous)

    return DEFAULT_SCAN_FROM


def existing_lookup_sets(items):
    hashes = set()
    filenames = set()

    for item in items:
        if item.get("hash"):
            hashes.add(item["hash"])
        if item.get("file"):
            filenames.add(Path(item["file"]).name.lower())

    return hashes, filenames


def passes_legacy_filters(path: Path) -> bool:
    name = path.name
    lower = name.lower()

    if name.startswith("20"):
        return False
    if name.startswith("Screenshot"):
        return False
    if name.startswith("PXL_"):
        return False
    if name.startswith("Messenger_creation"):
        return False
    if path.stat().st_size >= 3_000_000:
        return False
    if lower.endswith(".gif"):
        return False

    return True


def collect_candidates(scan_from: datetime):
    candidates = []
    for path in IMMICH_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in IMAGE_EXTS:
            continue
        modified = datetime.fromtimestamp(path.stat().st_mtime)
        if modified < scan_from:
            continue
        if not passes_legacy_filters(path):
            continue
        candidates.append(path)

    candidates.sort(key=lambda item: item.stat().st_mtime)
    return candidates


def filter_candidates_by_exact_name(candidates, exact_names: list[str]):
    wanted = {name.lower() for name in exact_names}
    filtered = [path for path in candidates if path.name.lower() in wanted]
    filtered.sort(key=lambda item: item.stat().st_mtime)
    return filtered


def build_item(image_path: Path, source_path: Path, file_hash: str, text: str, caption: str) -> dict:
    source_modified = datetime.fromtimestamp(source_path.stat().st_mtime)
    stat = image_path.stat()

    return {
        "file": f"images/{image_path.name}",
        "thumb": f"thumbs/{image_path.stem}.jpg",
        "text": text,
        "caption": caption,
        "hash": file_hash,
        "created": datetime.now().isoformat(timespec="seconds"),
        "modified": source_modified.replace(microsecond=0).isoformat(),
        "size": stat.st_size,
        "basename": image_path.stem,
        "ext": image_path.suffix.lower(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", help="ISO date or datetime, for example 2026-01-01")
    parser.add_argument("--limit", type=int, help="Only inspect the first N filtered candidates")
    parser.add_argument(
        "--exact-name",
        action="append",
        default=[],
        help="Retry only files with this exact filename. Can be passed more than once.",
    )
    parser.add_argument(
        "--skip-caption",
        action="store_true",
        help="Do not run BLIP captioning. Useful for recovering files that crash in the caption step.",
    )
    parser.add_argument(
        "--stop-after-imports",
        type=int,
        help="Stop once this many new files have been imported in the current run",
    )
    args = parser.parse_args()

    IMAGES_DIR.mkdir(exist_ok=True)
    THUMBS_DIR.mkdir(exist_ok=True)
    EMB_DIR.mkdir(exist_ok=True)

    items = load_items()
    existing_hashes, existing_filenames = existing_lookup_sets(items)

    scan_from = resolve_scan_from(args.since)
    log(f"Scanning Immich from {scan_from.isoformat()}")
    save_status(phase="scanning", scan_from=scan_from.isoformat(), indexed_items=len(items))

    candidates = collect_candidates(scan_from)
    if args.exact_name:
        candidates = filter_candidates_by_exact_name(candidates, args.exact_name)
    if args.limit:
        candidates = candidates[: args.limit]

    log(f"Found {len(candidates)} candidate image files since cutoff")
    save_status(
        phase="candidates_found",
        scan_from=scan_from.isoformat(),
        candidate_count=len(candidates),
        indexed_items=len(items),
    )

    if not candidates:
        state = load_state()
        state["last_successful_scan"] = datetime.now().isoformat(timespec="seconds")
        save_state(state)
        save_status(phase="idle", candidate_count=0, indexed_items=len(items))
        log("Nothing new to import.")
        return

    device = "cuda" if torch.cuda.is_available() else "cpu"
    log(f"Using device: {device}")
    log("Loading CLIP model...")
    save_status(phase="loading_clip", candidate_count=len(candidates), indexed_items=len(items))
    clip_model, preprocess = build_clip(device)

    caption_processor = None
    caption_model = None
    if not args.skip_caption:
        log("Loading caption model...")
        save_status(phase="loading_caption", candidate_count=len(candidates), indexed_items=len(items))
        caption_processor, caption_model = build_captioner(device)

    imported = 0
    skipped_hash = 0
    skipped_filename = 0
    failed = 0
    processed = 0
    new_embeddings = []

    for source_path in tqdm(candidates, desc="Importing new memes into memes_v2"):
        if args.stop_after_imports and imported >= args.stop_after_imports:
            break

        save_status(
            phase="processing",
            current_file=source_path.name,
            candidate_count=len(candidates),
            processed=processed,
            imported=imported,
            skipped_hash=skipped_hash,
            skipped_filename=skipped_filename,
            indexed_items=len(items),
        )

        file_hash = md5_file(source_path)
        target_name = source_path.name

        if file_hash in existing_hashes:
            skipped_hash += 1
            processed += 1
            continue

        if target_name.lower() in existing_filenames:
            skipped_filename += 1
            processed += 1
            continue

        image_path = IMAGES_DIR / target_name
        thumb_path = THUMBS_DIR / f"{source_path.stem}.jpg"

        image_path.write_bytes(source_path.read_bytes())

        try:
            make_square_thumb(image_path, thumb_path)
            text = ocr_text(image_path)
            if args.skip_caption:
                caption = ""
            else:
                caption = image_caption(caption_processor, caption_model, device, image_path)
            emb = image_embedding(clip_model, preprocess, device, image_path)

            items.append(build_item(image_path, source_path, file_hash, text, caption))
            new_embeddings.append(emb)
            existing_hashes.add(file_hash)
            existing_filenames.add(target_name.lower())
            imported += 1
            del emb
            gc.collect()

        except Exception:
            if image_path.exists():
                image_path.unlink()
            if thumb_path.exists():
                thumb_path.unlink()
            failed += 1
            log(f"Skipping failed file: {source_path.name}")
            gc.collect()
            processed += 1
            continue

        processed += 1
        if processed % 10 == 0:
            gc.collect()

    if new_embeddings:
        save_status(
            phase="writing_embeddings",
            processed=processed,
            imported=imported,
            skipped_hash=skipped_hash,
            skipped_filename=skipped_filename,
            indexed_items=len(items),
        )
        dim = len(new_embeddings[0])
        existing = load_existing_embeddings()
        if existing.size:
            existing = existing.reshape(-1, dim)
            combined = np.vstack([existing, np.array(new_embeddings, dtype=np.float32)])
        else:
            combined = np.array(new_embeddings, dtype=np.float32)
        write_embedding_bins(combined, dim)

    items.sort(key=lambda item: item.get("modified", ""), reverse=True)
    save_json(INDEX_PATH, items)

    state = load_state()
    state["last_successful_scan"] = datetime.now().isoformat(timespec="seconds")
    save_state(state)

    save_status(
        phase="complete",
        processed=processed,
        imported=imported,
        skipped_hash=skipped_hash,
        skipped_filename=skipped_filename,
        failed=failed,
        indexed_items=len(items),
    )

    log(
        "\nImported {0} new files, skipped {1} duplicate hashes, {2} duplicate filenames, and {3} failed files.".format(
            imported,
            skipped_hash,
            skipped_filename,
            failed,
        )
    )
    log(f"memes_v2 index now has {len(items)} items.")
    gc.collect()


if __name__ == "__main__":
    main()
