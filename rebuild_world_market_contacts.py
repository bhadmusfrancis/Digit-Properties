"""
Rebuild WhatsApp Chat - WORLD MARKET/contacts.txt from member-list screenshots.

Format:
  name<TAB>phone
  old_name<TAB>phone<TAB>new_name   # when screenshot name differs from prior contacts

Primary name (col1) stays the OLD name when a rename is detected so existing
lookups keep working; new WA pushname is stored in col3 and also registered
for phone matching via load_contacts.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

REPO = Path(__file__).resolve().parent
TESSERACT_EXE = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
ASSETS = Path(r"C:\Users\User\.cursor\projects\c-Users-User-Desktop-Digit-Properties\assets")
OUT_PATH = REPO / "WhatsApp Chat - WORLD MARKET" / "contacts.txt"
OCR_DIR = REPO / "ocr_tmp_world_market"
OLD_CONTACTS = OUT_PATH
CURATED_JSON = OCR_DIR / "curated_verified.json"


def phone_key(phone: str) -> str:
    return "".join(c for c in phone if c.isdigit())


def normalize_phone(raw: str) -> str | None:
    if "+234" not in raw and not re.search(r"\b234\b", raw):
        digits = re.sub(r"\D", "", raw)
        if digits.startswith("234") and len(digits) >= 13:
            pass
        elif digits.startswith("0") and len(digits) == 11:
            digits = "234" + digits[1:]
        elif len(digits) == 10 and digits[0] in "789":
            digits = "234" + digits
        else:
            return None
    else:
        digits = re.sub(r"\D", "", raw)
    if not digits.startswith("234"):
        return None
    d = digits[3:]
    if len(d) < 10:
        return None
    d = d[:10]
    return f"+234 {d[:3]} {d[3:6]} {d[6:10]}"


def normalize_name_key(s: str) -> str:
    s = unicodedata.normalize("NFKC", s or "")
    s = "".join(ch for ch in s if unicodedata.category(ch) not in ("Cf",))
    s = s.replace("\u202f", " ").replace("\xa0", " ")
    s = re.sub(r"^~+\s*", "", s.strip().lower())
    s = re.sub(r"\s+", " ", s)
    # ignore trailing ellipsis from UI truncation
    s = s.rstrip(".").strip()
    return s


def clean_name(raw: str) -> str:
    s = unicodedata.normalize("NFKC", raw or "")
    s = s.replace("\u200e", "").replace("\u200f", "").lstrip("\ufeff")
    s = s.strip()
    # OCR often prefixes avatar garbage before the real "~ Name"
    if "~" in s:
        s = s.split("~")[-1]
    s = re.sub(r"^~+\s*", "", s.strip())
    # strip leading non-name junk only (digits / punctuation), not real words like "AL"/"Big"
    s = re.sub(r"^[\W\d_]+", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.rstrip(".").strip()
    # drop UI chrome
    if s.lower() in {"search", "search members", "people"}:
        return ""
    if re.fullmatch(r"\d+\s*people", s.lower()):
        return ""
    if re.fullmatch(r"[\W\d_]+", s or ""):
        return ""
    return s


def plausible_rename(old: str, new: str) -> bool:
    """Accept rename only when names look related (avoid OCR cross-wiring)."""
    if not names_differ(old, new):
        return False
    a, b = normalize_name_key(old), normalize_name_key(new)
    alnum = lambda s: re.sub(r"[^a-z0-9@]+", "", s)
    aa, bb = alnum(a), alnum(b)
    if aa and bb and (aa in bb or bb in aa) and min(len(aa), len(bb)) >= 5:
        return True
    at, bt = set(a.split()), set(b.split())
    # drop tiny tokens
    at = {t for t in at if len(t) >= 3}
    bt = {t for t in bt if len(t) >= 3}
    if not at or not bt:
        return bool(aa and bb and aa[:5] == bb[:5])
    overlap = at & bt
    if len(overlap) >= 1 and (len(overlap) / max(len(at), len(bt)) >= 0.34):
        return True
    # email local-part / username style swaps
    if "@" in a or "@" in b:
        return aa.split("@")[0] == bb.split("@")[0] or aa in bb or bb in aa
    return False


def is_valid_name(name: str) -> bool:
    if not name or len(name) < 1:
        return False
    # allow emoji-only rare pushnames
    if name.strip() in {"😘"}:
        return True
    if not re.search(r"[A-Za-z0-9@]", name) and not re.search(r"[\U0001F300-\U0001FAFF]", name):
        return False
    return True


def load_old_contacts(path: Path) -> dict[str, str]:
    """phone_key -> primary (old) name"""
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip().lstrip("\ufeff")
        if not line or "\t" not in line:
            continue
        parts = line.split("\t")
        name, phone = parts[0].strip(), parts[1].strip()
        if not name or not phone:
            continue
        key = phone_key(phone)
        # prefer longer existing name if duplicates
        prev = out.get(key)
        if prev is None or len(name) > len(prev):
            out[key] = name
    return out


def ocr_image(img_path: Path, index: int) -> str:
    OCR_DIR.mkdir(parents=True, exist_ok=True)
    im = Image.open(img_path)
    w, h = im.size
    crop_w = int(w * 0.86)
    im = im.crop((0, 0, crop_w, h))
    im = ImageOps.grayscale(im)
    im = ImageEnhance.Contrast(im).enhance(2.0)
    im = ImageEnhance.Sharpness(im).enhance(2.0)
    crop_path = OCR_DIR / f"crop_{index}.png"
    im.save(crop_path)
    out_base = OCR_DIR / f"ocr_{index}"
    subprocess.run(
        [TESSERACT_EXE, str(crop_path), str(out_base), "-l", "eng", "--psm", "6"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    txt_path = OCR_DIR / f"ocr_{index}.txt"
    if not txt_path.exists():
        return ""
    return txt_path.read_text(encoding="utf-8", errors="ignore")


def extract_from_ocr_text(text: str) -> list[tuple[str, str]]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    contacts: list[tuple[str, str]] = []
    last_name: str | None = None
    for i, ln in enumerate(lines):
        phone = normalize_phone(ln) if ("234" in re.sub(r"\D", "", ln) or "+234" in ln) else None
        if phone:
            name_raw = last_name
            if not name_raw:
                for j in range(i - 1, max(-1, i - 4), -1):
                    candidate = lines[j]
                    if "+234" not in candidate and re.search(r"[A-Za-z@\U0001F300-\U0001FAFF]", candidate):
                        name_raw = candidate
                        break
            name = clean_name(name_raw or "")
            if name and is_valid_name(name):
                contacts.append((name, phone))
        else:
            if "+234" not in ln and re.search(r"[A-Za-z@\U0001F300-\U0001FAFF]", ln):
                last_name = ln
    return contacts


def discover_screenshots() -> list[Path]:
    # Prefer the exact batch attached in chat (filenames contain 1.20)
    batch = sorted(
        p
        for p in ASSETS.glob("*.png")
        if "WhatsApp_Image_2026-08-09_at_1.20" in p.name or "1.20." in p.name
    )
    if batch:
        return batch
    return sorted(ASSETS.glob("*.png"))


def names_differ(old: str, new: str) -> bool:
    a, b = normalize_name_key(old), normalize_name_key(new)
    if not a or not b:
        return False
    if a == b:
        return False
    # truncation / ellipsis variants of same name
    if a.startswith(b) or b.startswith(a):
        shorter = a if len(a) <= len(b) else b
        if len(shorter) >= 12:
            return False
    # alnum-only equality (emoji/punct noise)
    alnum = lambda s: re.sub(r"[^a-z0-9@]+", "", s)
    aa, bb = alnum(a), alnum(b)
    if aa and aa == bb:
        return False
    # OCR 1–2 char glitch (Realtor vs Realtot)
    if aa and bb and abs(len(aa) - len(bb)) <= 2 and len(aa) >= 10:
        diffs = sum(1 for x, y in zip(aa, bb) if x != y) + abs(len(aa) - len(bb))
        if diffs <= 2:
            return False
    return True


def main() -> None:
    old_by_phone = load_old_contacts(OLD_CONTACTS)
    # also fold All_contacts as prior names
    all_path = REPO / "All_contacts.txt"
    for k, v in load_old_contacts(all_path).items():
        if k not in old_by_phone or len(v) > len(old_by_phone[k]):
            # only use All_contacts to fill gaps for phones we already saw in WM OCR/curated
            pass
    # Keep WM-local old names authoritative; All_contacts used only for rename detect on shared phones
    all_by_phone = load_old_contacts(all_path)
    prior = dict(all_by_phone)
    prior.update(old_by_phone)  # WM overrides

    phone_to_new: dict[str, str] = {}
    curated_keys: set[str] = set()

    # 1) curated first (trusted screenshot reads only — never invent phones)
    curated: list[tuple[str, str]] = []
    if CURATED_JSON.is_file():
        curated = [(a, b) for a, b in json.loads(CURATED_JSON.read_text(encoding="utf-8"))]
    print(f"Curated verified rows: {len(curated)}")
    for name, phone in curated:
        phone_n = normalize_phone(phone) or phone
        key = phone_key(phone_n)
        name = clean_name(name)
        if not key or not is_valid_name(name):
            continue
        curated_keys.add(key)
        prev = phone_to_new.get(key)
        if prev is None or (not name.endswith("...") and (prev.endswith("...") or len(name) >= len(prev))):
            phone_to_new[key] = name

    # 2) OCR screenshots (never override curated phones)
    images = discover_screenshots()
    print(f"OCR images: {len(images)}")
    for idx, img in enumerate(images):
        print(f"  {idx + 1}/{len(images)}: {img.name[:60]}...")
        text = ocr_image(img, idx)
        for name, phone in extract_from_ocr_text(text):
            key = phone_key(phone)
            if not key or key in curated_keys:
                continue
            name = clean_name(name)
            if not is_valid_name(name):
                continue
            prev = phone_to_new.get(key)
            if prev is None:
                phone_to_new[key] = name
            elif prev.endswith("...") and not name.endswith("...") and len(name) >= 8:
                phone_to_new[key] = name
            elif len(name) > len(prev) + 3 and not name.endswith("..."):
                phone_to_new[key] = name

    # 3) keep prior WM contacts not seen in screenshots (still useful)
    for key, old_name in old_by_phone.items():
        if key not in phone_to_new:
            phone_to_new[key] = old_name

    rows: list[tuple[str, str, str | None]] = []
    renames = 0
    for key, new_name in phone_to_new.items():
        phone = normalize_phone(key) or (
            f"+234 {key[-10:-7]} {key[-7:-4]} {key[-4:]}" if key.endswith(key[-10:]) and len(key) >= 10 else key
        )
        if key.startswith("234") and len(key) >= 13:
            d = key[3:13]
            phone = f"+234 {d[:3]} {d[3:6]} {d[6:10]}"
        elif len(key) == 10:
            phone = f"+234 {key[:3]} {key[3:6]} {key[6:10]}"
        else:
            # key may already be full digits
            d = key[-10:] if len(key) >= 10 else key
            if len(d) == 10:
                phone = f"+234 {d[:3]} {d[3:6]} {d[6:10]}"

        old_name = prior.get(key)
        if old_name and key in curated_keys and names_differ(old_name, new_name):
            # Trusted screenshot name → keep old, store new
            rows.append((old_name, phone, new_name))
            renames += 1
        elif old_name and key not in curated_keys and plausible_rename(old_name, new_name):
            rows.append((old_name, phone, new_name))
            renames += 1
        elif old_name and key not in curated_keys and names_differ(old_name, new_name):
            # OCR disagrees but not a plausible rename — keep old name only
            rows.append((old_name, phone, None))
        else:
            primary = old_name if old_name and not names_differ(old_name, new_name) else new_name
            if old_name and normalize_name_key(new_name).startswith(normalize_name_key(old_name)) and len(new_name) > len(old_name):
                primary = new_name
            rows.append((primary, phone, None))

    rows.sort(key=lambda r: (r[0].lower(), r[1]))

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    for name, phone, new_name in rows:
        if new_name:
            lines.append(f"{name}\t{phone}\t{new_name}")
        else:
            lines.append(f"{name}\t{phone}")
    OUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")

    print(f"\nWrote {OUT_PATH}")
    print(f"Contacts: {len(rows)} | Renames (old+new): {renames}")
    print("Sample renames:")
    shown = 0
    for name, phone, new_name in rows:
        if not new_name:
            continue
        print(f"  {name!r} -> {new_name!r} | {phone}")
        shown += 1
        if shown >= 40:
            break


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    main()
