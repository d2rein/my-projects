from pathlib import Path
import shutil

import cv2


ROOT = Path(__file__).resolve().parent
IMAGE_DIR = ROOT.parent / "postcards" / "images"
BACKUP_DIR = ROOT / "data" / "pre-recrop-images"
KEEP_WIDTH = 0.84


def main() -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    changed = 0
    for path in sorted(IMAGE_DIR.glob("*.webp")):
        backup = BACKUP_DIR / path.name
        if backup.exists():
            continue
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if image is None:
            print(f"Skipped unreadable image: {path.name}")
            continue
        shutil.copy2(path, backup)
        right = max(1, round(image.shape[1] * KEEP_WIDTH))
        cropped = image[:, :right]
        ok, encoded = cv2.imencode(".webp", cropped, [cv2.IMWRITE_WEBP_QUALITY, 95])
        if not ok:
            raise RuntimeError(f"Could not encode {path.name}")
        temporary = path.with_suffix(".webp.tmp")
        temporary.write_bytes(encoded.tobytes())
        temporary.replace(path)
        changed += 1
    print(f"Re-cropped {changed} images; originals are in {BACKUP_DIR}")


if __name__ == "__main__":
    main()
