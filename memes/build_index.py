import os
import json
from PIL import Image
import pytesseract
from tqdm import tqdm

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

IMAGE_DIR = "images"
THUMB_DIR = "thumbs"
OUTPUT_JSON = "memes.json"

os.makedirs(THUMB_DIR, exist_ok=True)

memes = []

for filename in tqdm(os.listdir(IMAGE_DIR)):
    if not filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        continue

    path = os.path.join(IMAGE_DIR, filename)

    try:
        # OCR
        text = pytesseract.image_to_string(
            Image.open(path),
            config="--psm 6"
        ).strip().replace("\n", " ")

        # Create thumbnail
        img = Image.open(path)
        img.thumbnail((300, 300))
        thumb_path = os.path.join(THUMB_DIR, filename)
        img.save(thumb_path)

        memes.append({
            "file": f"images/{filename}",
            "thumb": f"thumbs/{filename}",
            "text": text.lower()
        })

    except Exception as e:
        print(f"Error processing {filename}: {e}")

with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(memes, f, ensure_ascii=False)

print("Done! Index created.")