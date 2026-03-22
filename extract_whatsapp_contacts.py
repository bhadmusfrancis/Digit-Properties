import os
import re
import subprocess
from pathlib import Path
import sys

from PIL import Image, ImageOps, ImageEnhance


TESSERACT_EXE = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

ASSETS_DIR = Path(r"C:\Users\User\.cursor\projects\c-Users-User-Desktop-Digit-Properties\assets")

# Find the uploaded WhatsApp screenshots automatically.
IMAGES = sorted(
    str(p)
    for p in ASSETS_DIR.glob("*WhatsApp_Image_2026-03-20_at_12.16*.png")
)

# Optional cap to speed up debugging: pass an argument, e.g. `python script.py 6`.
MAX_IMAGES = int(os.environ.get("MAX_IMAGES", "0")) or None


def normalize_phone_from_line(line: str) -> str | None:
    if "+234" not in line:
        return None
    digits = re.sub(r"\D", "", line)
    if not digits.startswith("234"):
        return None
    d = digits[3:]
    if len(d) < 10:
        return None
    d = d[:10]
    a, b, c = d[:3], d[3:6], d[6:10]
    return f"+234 {a} {b} {c}"


ALLOWED_NAME_CHARS_RE = re.compile(r"[^A-Za-z0-9@&\-\.'()/_ ]+")


def clean_name(raw: str) -> str:
    s = raw.strip()
    s = s.lstrip("~").strip()
    s = s.replace("\u201c", "").replace("\u201d", "")
    s = ALLOWED_NAME_CHARS_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()

    # Strip leading OCR noise (icons / A-Z index / row numbers).
    s = re.sub(r"^[^A-Za-z0-9@]+", "", s).strip()

    parts = [p for p in s.split(" ") if p]

    # Drop leading OCR artifacts like "1", "2)", "3.".
    while parts and re.fullmatch(r"\d{1,4}[\)\.]*", parts[0]):
        parts.pop(0)
    # Drop leading OCR artifacts like "2a" that show up with the row/index.
    while parts and re.fullmatch(r"\d{1,4}[A-Za-z]", parts[0]):
        parts.pop(0)
    # Drop leading stray '@' tokens.
    while parts and parts[0] == "@":
        parts.pop(0)

    cleaned_parts: list[str] = []
    for p in parts:
        pp = p.strip()
        if not pp:
            continue
        # Drop punctuation-only artifacts (e.g. ')', '\"', etc.).
        if not re.search(r"[A-Za-z0-9@]", pp):
            continue
        # Drop numeric artifacts like "2)" or "9." that shouldn't be part of a name.
        if not re.search(r"[A-Za-z@]", pp) and re.fullmatch(r"[\d\)\.\,\/]+", pp):
            continue
        if pp == "@":
            continue
        if pp in set(list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")):
            continue
        if re.fullmatch(r"\d+", pp):
            continue
        if "/" in pp and not re.search(r"[A-Za-z@]", pp):
            continue
        if len(pp) <= 2 and pp.isalpha():
            continue
        cleaned_parts.append(pp)

    out = " ".join(cleaned_parts).strip()
    # Extra safety: sometimes OCR noise leaves leading '&' attached.
    out = out.lstrip("&").strip()
    out = out.lstrip("@").strip()
    out = out.strip(" .,:;")
    return out


def ocr_image(img_path: str, out_dir: Path, index: int) -> str:
    # Crop away the right-side alphabetical index to reduce OCR noise.
    im = Image.open(img_path)
    w, h = im.size
    crop_w = int(w * 0.86)
    im = im.crop((0, 0, crop_w, h))
    im = ImageOps.grayscale(im)
    im = ImageEnhance.Contrast(im).enhance(2.0)
    im = ImageEnhance.Sharpness(im).enhance(2.0)

    crop_path = out_dir / f"crop_{index}.png"
    im.save(crop_path)

    out_base = out_dir / f"ocr_{index}"
    # Tesseract creates <out_base>.txt
    cmd = [
        TESSERACT_EXE,
        str(crop_path),
        str(out_base),
        "-l",
        "eng",
        "--psm",
        "6",
    ]
    subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    txt_path = out_dir / f"ocr_{index}.txt"
    if not txt_path.exists():
        return ""
    return txt_path.read_text(encoding="utf-8", errors="ignore")


def extract_contacts_from_text(text: str) -> list[tuple[str, str]]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    contacts: list[tuple[str, str]] = []
    last_name_line = None

    for i, ln in enumerate(lines):
        phone = normalize_phone_from_line(ln)
        if phone:
            # Find a likely name from nearby previous lines.
            name_raw = last_name_line
            if not name_raw and i > 0:
                for j in range(i - 1, max(-1, i - 4), -1):
                    candidate = lines[j]
                    if "+234" not in candidate and re.search(r"[A-Za-z@]", candidate):
                        name_raw = candidate
                        break
            if name_raw:
                name = clean_name(name_raw)
            else:
                name = ""
            if name:
                contacts.append((name, phone))
        else:
            # Keep the most recent name-ish line.
            if "+234" not in ln and re.search(r"[A-Za-z@]", ln):
                last_name_line = ln
    return contacts


def main():
    base_dir = Path(__file__).resolve().parent
    out_dir = base_dir / "ocr_tmp"
    out_dir.mkdir(parents=True, exist_ok=True)

    phone_to_name: dict[str, str] = {}

    max_override = None
    if len(sys.argv) >= 2:
        try:
            max_override = int(sys.argv[1])
        except Exception:
            max_override = None

    limit = max_override if max_override is not None else MAX_IMAGES
    selected_images = IMAGES if limit is None else IMAGES[:limit]
    for idx, img in enumerate(selected_images):
        if not os.path.exists(img):
            continue
        txt = ocr_image(img, out_dir, idx)
        contacts = extract_contacts_from_text(txt)
        for name, phone in contacts:
            # Keep the first seen name for a phone number.
            if phone not in phone_to_name:
                phone_to_name[phone] = name

    items = [(name, phone) for phone, name in phone_to_name.items()]
    items.sort(key=lambda x: x[0].lower())

    out_path = base_dir / "contacts.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        for name, phone in items:
            f.write(f"{name}\t{phone}\n")

    print(f"Wrote {len(items)} contacts to: {out_path}")


if __name__ == "__main__":
    main()

