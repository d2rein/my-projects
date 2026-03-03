import os
from PIL import Image
from tqdm import tqdm

SOURCE_DIR = "images"
OUTPUT_DIR = "images_compressed"

os.makedirs(OUTPUT_DIR, exist_ok=True)

for filename in tqdm(os.listdir(SOURCE_DIR)):
    if not filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        continue

    input_path = os.path.join(SOURCE_DIR, filename)
    output_filename = os.path.splitext(filename)[0] + ".jpg"
    output_path = os.path.join(OUTPUT_DIR, output_filename)

    try:
        img = Image.open(input_path).convert("RGB")

        # Resize if wider than 1280px
        max_width = 1280
        if img.width > max_width:
            new_height = int((max_width / img.width) * img.height)
            img = img.resize((max_width, new_height), Image.LANCZOS)

        # Save compressed JPEG
        img.save(
            output_path,
            "JPEG",
            quality=70,
            optimize=True,
            progressive=True
        )

    except Exception as e:
        print(f"Error processing {filename}: {e}")

print("Compression complete.")