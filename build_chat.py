"""
Build chat.txt from _chat.txt: keep messages on/after 2026-03-19 00:00:00,
rewrite every message header to:
  [date, time] ~ <WhatsApp display name> ~ (<phone>):
using contacts.txt for phone lookup (fuzzy match + manual aliases).

Non-real-estate posts (car sales, procurement spam, business-plan promos, etc.)
are dropped; message bodies are never truncated within kept posts.

Near-duplicate listings (same or very similar body text) are collapsed so only
the first occurrence (by chat order) is kept.
"""
from __future__ import annotations

import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

from rapidfuzz import fuzz

HEADER_RE = re.compile(
    r"^[\u200e\u200f\s]*\[(?P<dt>[^\]]+)\]\s+(?:~\s*)?(?P<name>[^:]+):\s*(?P<body>.*)\s*$"
)

DEFAULT_CUTOFF = datetime(2026, 3, 19, 0, 0, 0)

MANUAL_CONTACT_NAME: dict[str, str] = {
    "oluwa is involve": "Oluwa Involve",
    "oputa onita": "onitaoputa",
    "chidiimmanuelgmail.com": "chidiimmanuel",
    "w. s. nation": "W.S.Nation",
    "samuel agunu enaikele": "Samuel Agunu-Enaikele (SAC",
    "selector realtors ltd.": "Hector Selector Realtors Ltd",
    "phlex global realty": "fj) Phlex Global Realty",
    "femzyfive": "p- Femzy properties",
    "femzy property": "p- Femzy properties",
    "festman home and property limited": "Festman Homes And Property",
    # High-confidence display-name / OCR variants (see unknown-phone audit)
    "adegokeadefolabi": "adegokeadefolabi1",
    "disnovariesconsult": "disnovaries consult",
    "shashamura!!!": "Shashamura",
    "gods own": "SURVEYOR ABBEY",  # same phone; merge keeps longer label
    "esv abiodun mabel kups": "ESV Mabel Kups",
    "de property manager": "PROPERTY MANAGER",
    "promisechampionchampion": "Pe promisechampionchampion",
    "rhezolladhomes&properties": "RHEZOLLADHOMES&PROPERT",
    "sakabolaemma": "sakabolaemma@gmail.com",
    "sakabolaemma@gamil.com": "sakabolaemma@gmail.com",
    "mumuniad": "mumuniad@gmail.com",
    "solankeseyi685": "G5 solankeseyi685",
    "michad🚘🛻🚍": "MICHAD fai",
    "codedteamey~autos 🚘": "Codedteamey Autos jay",
    "heritage real estate consult & multi-venture": "HERITAGE REAL ESTATE CONS...",
    "olatundebakrin": "bakrinolatundebakrin",
    "bakarinolatundeyusuf": "bakrinolatundebakrin",
    "bakrin olatunde yusuf": "bakrinolatundebakrin",
    "engineer bakrin olatunde": "bakrinolatundebakrin",
    "glory folarin": "folaringlory0",
    "mr ace": "Ace",
    "#coded😜": "#CODED🤪",
    "🙌🙌🙌premier 🙌🙌🙌": "🙌🙌🙌 PREMIER 🙌🙌🙌",
    "🙌🏿🙌🏿🙌🏿premier 🙌🏿🙌🏿🙌🏿": "🙌🙌🙌 PREMIER 🙌🙌🙌",
    "🙌🏿🙌🏿🙌🏿premier🙌🏿🙌": "🙌🙌🙌 PREMIER 🙌🙌🙌",
    "yusuf isah": "Yusuf sah",
    "tavaku emmanuel": "emmanueltavaku92",
    # World Market screenshot rebuild (Aug 2026)
    "nation": "W.S.Nation",
    "daniel damic": "Damicautos",
    "kelsey of few trades xoxo": "Kelsey Of Few Trades",
    "evang amos leggy of amos link integrated services": "I am Evangelist Amos the Chairman of Amos Link Group of Companies",
    "i am evangelist amos the executive head of amos link group": "I am Evangelist Amos the Chairman of Amos Link Group of Companies",
    "abayomi oluwadamilare": "Abayomi Owulade CP Josh",
    "elim-flow ltd (properties": "enematt77@gmail.com",
    "elim-flow int'l ltd": "enematt77@gmail.com",
    "engr clems": "Royal Properties",
    "property valuation services": "Real Estate",
    "patdarlens555@gmail.com": "Patrick-Darlens Ekwem",
    "progressive access group": "jem) P.a.p Realtors Group",
    "africansmustrise": "propertyplatform",
    "ib property": "properties",
    "vims ppties/gold 🪙 vendor": "VIMS Properties",
    "fresh property real estate agent": "freshproperty49",
    "hon.desmond": "possiblemakana",
    "onyema mitchel": "Omyema Okwukolo",
    "feadegloballink ltd": "felixadebowaleadebola",
    "yagazie": "Hallelujah",
    # User-supplied phones (Aug 2026)
    "benjamin": "Ben",
    "demola": "Yusuff Abbey Brother",
    "architect blessed fihsd": "Architect Blessed fihsd",
    "majam enoch david": "enochmajam2016",
    "enochmajam2016": "enochmajam2016",
    "imohiosen ohiwerei": "Imohiosen Ohiwerei",
    "@ph urban homes": "@PH URBAN HOMES",
    "ph urban homes": "@PH URBAN HOMES",
    "popsyne real estate consultant and automobile": "popoola av",
}

# Contact names that must never participate in substring/fuzzy matching.
# Exact match still works (e.g. a sender literally named "Property").
SUBSTRING_BLOCKLIST = frozenset(
    {
        "properties",
        "property",
        "enterprises",
        "ace",
        "asa",
        "poly",
        "residential",
        "ft'",
        "ft",
        "ade",
        "real estate",
        "realty",
        "homes",
        "home",
        "estate",
        "housing",
        "services",
        "limited",
        "ltd",
        "consultant",
        "manager",
        "property manager",
        "business",
        "agency",
        "group",
        "company",
        "companies",
        "nigeria",
        "lagos",
        "name",
        "myself",
        "anon",
        "choice",
        "smart",
        "smile",
        "shadow",
        "hybrid",
        "logic",
        "farmer",
        "automobile",
        "autos",
        "auto",
    }
)

_MATCH_STOPWORDS = frozenset({"and", "the", "of", "for", "ltd", "limited", "nig", "co", "a", "an"})
_MIN_FUZZY_CONTACT_LEN = 10
_MIN_CONTAIN_LEN = 12
_MIN_FUZZY_SCORE = 86.0

# Always treat as vehicle sales (not property marketing)
CAR_DEALER_SENDERS = frozenset(
    {
        "damic autos",
        "slimjoe060",
        "ceecee's autos hub",
        "sir pee auto",
    }
)

# Strong property / land signals (keep if matched)
RE_PROPERTY_SIGNAL = re.compile(
    r"""(?ix)
    \b(
        land(\s+for\s+sale)?|plot(s)?\s+of\s+land|bare\s*land|water\s*front|waterfront|
        sqm|sqft|sqmts|acre(s)?|
        duplex|bungalow|bedroom|bedrm|brdm|maisonette|terrace|apartment|flat|bq\b|
        warehouse(\s+for)?|to\s+let|letting|for\s+lease|for\s+rent|open\s+plan|
        joint\s+venture|\bjv\b|distress\s+sale.*(hotel|land|property|building|duplex)|
        title\s*:|c\s+of\s+o|cof\b|certificate\s+of\s+occupancy|governor'?s?\s+consent|
        survey\s+plan|deed\s+of\s+assignment|allocation|estate(\s+development)?|
        commercial\s+land|event\s+center.*\bland\b|hotel\s+for\s+sale|property\s+sale|
        tank\s+farm|jetty|waterfront\s+property|storey\s+building|units\s+of\s+.*bedroom
    )\b
    """
)

# Buyer / agent wants (still real-estate market activity)
RE_MARKET_REQUEST = re.compile(
    r"""(?ix)
    urgent\s+request|client\s+need|client\s+want|
    looking\s+for.*\b(bed|bedroom)|\b(budget|rent)\b.*m
    """
)

# Government-contract / procurement spam (not property)
RE_NONRE_PROCUREMENT = re.compile(
    r"""(?ix)
    award\s+letter.*(company|procurement)|procurement\s+registration|
    road\s+construction.*\b(bauchi|l\.?g\.?a)|solar\s+powered\s+borehole.*\d+\s*lga|
    contracts\s+for\s+sale.*award
    """
)

# Coaching / documents / seminars (not listings)
RE_NONRE_BUSINESS_COACHING = re.compile(
    r"""(?ix)
    \b(business\s+plan|feasibility\s+study)\b.*\b(farmers|dm\b|okene|call\s+08033|comprehensive\s+business)
    |get\s+(your|best)\s+comprehensive\s+business\s+plan
    |contact\s+us\s+today\s+for\s+your\s+business\s+plan
    """
)

# Vehicle / car sales (exclude unless clearly property — handled by ordering)
RE_CAR_SALES = re.compile(
    r"""(?ix)
    \b(toks\b|tokunb|carfax|mileage:\s*|foreign\s+used|buy\s+and\s+drive|duty\s+paid|duty\s+fully)\b
    |\b(mercedes|benz|lexus|toyota\s+(camry|sienna|highlander|grand)|honda\s+accord|hyundai\s+sonata|nx\d{3}|glc\d*|rx\s*330|rx\s*350|es350)\b
    |▪.*\b(toks|mercedes|lexus|toyota|honda|hyundai)\b
    |engine\s*💯|gear\s*💯.*\b(accord|camry|lexus|toyota|sienna|hummer)\b
    |toyota\s+hummer\s+bus|japa\s+mood|importer.*(lexus|toyota)
    """
)

# Strip volatile bits so the same listing matches across reposts
_DEDUP_STRIP = re.compile(
    r"(?ix)[\u200e\u200f]*<attached:[^>]+>|\bimage\s+omitted\b|https?://\S+|wa\.me/\S+"
)

# token_sort_ratio >= this => treat as duplicate of an earlier post
DEDUP_SIMILARITY = 90
# Ignore dedup for very short bodies (distinct blurbs)
DEDUP_MIN_CHARS = 55


def normalize_name(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) not in ("Cf",))
    s = s.replace("\u202f", " ").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s.strip().lower())
    return s


def digits_only(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKC", s) if c.isdigit())


def format_nigeria_phone(d: str) -> str | None:
    if len(d) < 10:
        return None
    if d.startswith("234") and len(d) >= 12:
        rest = d[3:]
        if len(rest) == 10:
            return f"+234 {rest[:3]} {rest[3:6]} {rest[6:]}"
    if d.startswith("0") and len(d) == 11:
        rest = d[1:]
        return f"+234 {rest[:3]} {rest[3:6]} {rest[6:]}"
    if len(d) == 10 and d[0] in "789":
        return f"+234 {d[:3]} {d[3:6]} {d[6:]}"
    return None


def phone_from_sender_name(name: str) -> str | None:
    d = digits_only(name)
    if len(d) < 10:
        return None
    return format_nigeria_phone(d)


def load_contacts(path: Path) -> list[tuple[str, str]]:
    """Load contacts.txt rows.

    Supported formats:
      name<TAB>phone
      old_name<TAB>phone<TAB>new_name

    When a third column (new_name) is present, both old and new names are
    registered against the same phone so chat headers resolve either way.
    """
    rows: list[tuple[str, str]] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip().lstrip("\ufeff")
        if not line or "\t" not in line:
            continue
        parts = [p.strip() for p in line.split("\t")]
        if len(parts) < 2:
            continue
        name, phone = parts[0].lstrip("\ufeff"), parts[1]
        if not name or not phone:
            continue
        rows.append((name, phone))
        if len(parts) >= 3 and parts[2]:
            new_name = parts[2].lstrip("\ufeff")
            if new_name and normalize_name(new_name) != normalize_name(name):
                rows.append((new_name, phone))
    return rows


def _match_tokens(s: str) -> list[str]:
    return [t for t in s.split() if t not in _MATCH_STOPWORDS and len(t) >= 3]


def best_contact_phone(sender: str, contacts: list[tuple[str, str]]) -> str | None:
    """Resolve a WhatsApp sender display name to a contacts.txt phone.

    Conservative by design: short/generic contact labels (e.g. "Property",
    "Real Estate") are exact-match only. Substring/fuzzy matching requires
    multi-token, non-generic contact names to avoid cross-wiring listings.
    """
    key = normalize_name(sender)
    if key in MANUAL_CONTACT_NAME:
        target = MANUAL_CONTACT_NAME[key]
        for cname, phone in contacts:
            if cname.strip() == target:
                return phone

    sender_phone = phone_from_sender_name(sender)
    if sender_phone:
        return sender_phone

    for cname, phone in contacts:
        if normalize_name(cname) == key:
            return phone

    best_phone: str | None = None
    best_score = 0.0
    key_toks = _match_tokens(key)
    for cname, phone in contacts:
        cn = normalize_name(cname)
        if not cn or not key:
            continue
        if cn in SUBSTRING_BLOCKLIST:
            continue
        cn_toks = _match_tokens(cn)
        # Short / single-token contacts: exact match only (handled above).
        if len(cn) < _MIN_FUZZY_CONTACT_LEN or len(cn_toks) < 2:
            continue

        score = 0.0
        # Multi-token containment: phone-book name is a stable short form of the WA name.
        if cn in key or key in cn:
            shorter = cn if len(cn) <= len(key) else key
            if len(shorter) >= _MIN_CONTAIN_LEN and len(_match_tokens(shorter)) >= 2:
                score = 94.0

        if score == 0.0:
            tsort = float(fuzz.token_sort_ratio(key, cn))
            tset = float(fuzz.token_set_ratio(key, cn))
            wr = float(fuzz.WRatio(key, cn))
            pr = float(fuzz.partial_ratio(key, cn))
            # Subset trap: e.g. contact "Automobile" vs "... and automobile"
            if tset - tsort >= 25:
                continue
            score = max(tsort, wr if wr >= 92 else 0.0)
            if pr >= 95 and tsort >= 84:
                score = max(score, tsort, 88.0)
            if score < _MIN_FUZZY_SCORE:
                continue
            if not (set(key_toks) & set(cn_toks)):
                continue

        if score > best_score:
            best_score = score
            best_phone = phone

    if best_score >= _MIN_FUZZY_SCORE:
        return best_phone
    return None


def parse_whatsapp_dt(dt_str: str) -> datetime | None:
    cleaned = (
        dt_str.replace("\u202f", " ")
        .replace("\xa0", " ")
        .replace("\u200e", "")
        .replace("\u200f", "")
        .strip()
    )
    for fmt in ("%m/%d/%y, %I:%M:%S %p", "%m/%d/%y, %I:%M:%S%p"):
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            continue
    return None


def display_name_raw(name: str) -> str:
    n = unicodedata.normalize("NFKC", name)
    n = n.replace("\u200e", "").replace("\u200f", "")
    return n.strip()


def is_real_estate_post(full_text: str, sender_label: str) -> bool:
    """Return True if this WhatsApp message should be kept as real-estate related."""
    skey = normalize_name(sender_label)
    if skey in CAR_DEALER_SENDERS:
        return False

    low = unicodedata.normalize("NFKC", full_text).lower()
    low = low.replace("\u202f", " ")

    if "this message was deleted" in low:
        return False

    # Noise-only replies (no listing substance)
    compact = re.sub(r"\s+", " ", low).strip()
    if len(compact) < 18 and "concerning this" in compact:
        return False

    if RE_NONRE_PROCUREMENT.search(full_text):
        return False
    if RE_NONRE_BUSINESS_COACHING.search(full_text):
        return False

    if RE_PROPERTY_SIGNAL.search(full_text) or RE_MARKET_REQUEST.search(full_text):
        return True

    # Peace City / allocation style land promos (often no "sqm" in first line)
    if "peace city" in low and ("allocation" in low or "mortgage" in low):
        return True

    if RE_CAR_SALES.search(full_text):
        return False

    # Very short / attachment-only — drop if no property signal
    if len(compact) < 35:
        return False

    return False


def extract_message_body_text(full_message: str) -> str:
    """Body = text after `~ (phone):` on the first line, plus continuation lines."""
    lines = full_message.splitlines(keepends=True)
    if not lines:
        return ""
    first = lines[0]
    m = re.search(r"\([^)]+\):\s*", first)
    if m:
        rest_of_first = first[m.end() :]
    else:
        rest_of_first = first
    return (rest_of_first + "".join(lines[1:])).strip()


def fingerprint_listing_body(body: str) -> str:
    """Normalize listing text for similarity comparison."""
    t = _DEDUP_STRIP.sub(" ", body)
    t = unicodedata.normalize("NFKC", t).lower()
    t = re.sub(r"[^\w\s]", " ", t)
    t = re.sub(r"\d+", " # ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def dedupe_similar_posts(messages: list[str]) -> tuple[list[str], int]:
    """Keep first occurrence; drop later posts whose body is very similar to an earlier one."""
    kept: list[str] = []
    fps: list[str] = []
    dropped = 0
    for msg in messages:
        body = extract_message_body_text(msg)
        fp = fingerprint_listing_body(body)
        if len(fp) < DEDUP_MIN_CHARS:
            kept.append(msg)
            fps.append(fp)
            continue
        dup = False
        for prev in fps:
            if len(prev) < DEDUP_MIN_CHARS:
                continue
            if fuzz.token_sort_ratio(fp, prev) >= DEDUP_SIMILARITY:
                dup = True
                break
        if dup:
            dropped += 1
            continue
        kept.append(msg)
        fps.append(fp)
    return kept, dropped


def format_message_if_kept(
    buf: list[str],
    contacts: list[tuple[str, str]],
    unmatched: dict[str, int],
    cutoff: datetime,
) -> str | None:
    first = buf[0]
    m = HEADER_RE.match(first)
    if not m:
        return None
    dt_s = m.group("dt")
    name_raw = m.group("name")
    body = m.group("body")
    parsed = parse_whatsapp_dt(dt_s)
    if parsed is None or parsed < cutoff:
        return None

    full_text = "".join(buf)
    label = display_name_raw(name_raw)
    if not is_real_estate_post(full_text, label):
        return None

    phone = best_contact_phone(name_raw, contacts)
    if phone is None:
        phone = "unknown"
        nk = normalize_name(label)
        unmatched[nk] = unmatched.get(nk, 0) + 1

    bracket_ts = "[" + dt_s + "]"
    if body.strip():
        head = f"{bracket_ts} ~ {label} ~ ({phone}): {body}\n"
    else:
        head = f"{bracket_ts} ~ {label} ~ ({phone}):\n"
    return head + "".join(buf[1:])


def main() -> None:
    base = Path(__file__).resolve().parent
    src = base / "_chat.txt"
    cpath = base / "contacts.txt"
    out = base / "chat.txt"
    if not src.is_file():
        print(f"Missing {src}", file=sys.stderr)
        sys.exit(1)
    if not cpath.is_file():
        print(f"Missing {cpath}", file=sys.stderr)
        sys.exit(1)

    cutoff = DEFAULT_CUTOFF
    if out.is_file():
        last_dt: datetime | None = None
        for line in out.read_text(encoding="utf-8", errors="replace").splitlines():
            m = HEADER_RE.match(line)
            if not m:
                continue
            dt = parse_whatsapp_dt(m.group("dt"))
            if dt is None:
                continue
            if last_dt is None or dt > last_dt:
                last_dt = dt
        if last_dt is not None:
            cutoff = last_dt

    contacts = load_contacts(cpath)
    unmatched: dict[str, int] = {}
    buf: list[str] = []
    collected: list[str] = []

    with src.open("r", encoding="utf-8", errors="replace") as fin:
        for raw in fin:
            if HEADER_RE.match(raw):
                if buf:
                    got = format_message_if_kept(buf, contacts, unmatched, cutoff)
                    if got:
                        collected.append(got)
                buf = [raw]
            else:
                if buf:
                    buf.append(raw)
        if buf:
            got = format_message_if_kept(buf, contacts, unmatched, cutoff)
            if got:
                collected.append(got)

    before = len(collected)
    deduped, n_drop_sim = dedupe_similar_posts(collected)
    out.write_text("".join(deduped), encoding="utf-8", newline="\n")

    print(f"Wrote {out}")
    print(f"Cutoff used: {cutoff.isoformat(sep=' ')}")
    print(f"Messages after real-estate filter: {before}")
    print(f"Similar duplicates removed (keeping first): {n_drop_sim}")
    print(f"Final messages: {len(deduped)}")
    if unmatched:
        print("Senders with no contact match (count):", len(unmatched))
        for k, v in sorted(unmatched.items(), key=lambda x: -x[1])[:25]:
            safe = repr(k).encode("ascii", "backslashreplace").decode("ascii")
            print(f"  {v}x  {safe}")


if __name__ == "__main__":
    main()
