"""
Re-resolve WhatsApp sender phones with the tightened contact matcher and repair:
  1) repo-root All_chats.txt headers
  2) every export folder chat.txt with `~ (phone):` headers
  3) MongoDB listing.agentPhone values that were wired from those false matches

Usage (from web/):
  python scripts/repair-false-contact-phones.py --dry-run
  python scripts/repair-false-contact-phones.py
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

REPO = Path(__file__).resolve().parents[2]
ALL_CHATS = REPO / "All_chats.txt"
ALL_CONTACTS = REPO / "All_contacts.txt"

if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from build_chat import best_contact_phone, load_contacts

HEADER_PHONE_RE = re.compile(
    r"^(\[[^\]]+\]\s+~\s+)(.+?)(\s+~\s+\()([^)]*)(\):\s*)(.*)$"
)


def rewrite_chat_file(path: Path, contacts: list[tuple[str, str]], dry_run: bool) -> tuple[int, int, Counter[str]]:
    """Rewrite phone headers. Returns (messages_seen, messages_changed, change_counts)."""
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    seen = 0
    changed = 0
    changes: Counter[str] = Counter()
    for line in lines:
        m = HEADER_PHONE_RE.match(line.rstrip("\r\n"))
        if not m:
            out.append(line)
            continue
        seen += 1
        prefix, name, mid, old_phone, suffix, rest = m.groups()
        new_phone = best_contact_phone(name, contacts) or "unknown"
        old = old_phone.strip()
        if new_phone != old:
            changed += 1
            changes[f"{old} -> {new_phone}"] += 1
            nl = "\r\n" if line.endswith("\r\n") else "\n" if line.endswith("\n") else ""
            out.append(f"{prefix}{name}{mid}{new_phone}{suffix}{rest}{nl}")
        else:
            out.append(line)
    if changed and not dry_run:
        path.write_text("".join(out), encoding="utf-8", newline="")
    return seen, changed, changes


def normalize_phone_digits(phone: str | None) -> str:
    if not phone:
        return ""
    d = re.sub(r"\D", "", phone)
    if d.startswith("234") and len(d) >= 13:
        d = d[-10:]
    elif d.startswith("0") and len(d) == 11:
        d = d[1:]
    elif len(d) > 10:
        d = d[-10:]
    return d


def format_agent_phone(phone: str) -> str:
    """Store as +234XXXXXXXXXX (no spaces), matching import style."""
    d = normalize_phone_digits(phone)
    if len(d) != 10:
        return ""
    return f"+234{d}"


def repair_mongo(contacts: list[tuple[str, str]], dry_run: bool) -> tuple[int, int, Counter[str]]:
    load_dotenv(REPO / "web" / ".env.local")
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        print("MONGODB_URI not set; skipping Mongo repair", file=sys.stderr)
        return 0, 0, Counter()

    client = MongoClient(uri)
    # Prefer URI db; fall back to 'test' (project default).
    db = client.get_default_database()
    if db is None:
        db = client["test"]
    col = db["listings"]

    cursor = col.find(
        {
            "tags": "whatsapp-chat-import",
            "agentName": {"$type": "string", "$ne": ""},
        },
        {"agentName": 1, "agentPhone": 1, "title": 1, "slug": 1},
    )

    ops: list[UpdateOne] = []
    scanned = 0
    changes: Counter[str] = Counter()
    samples: list[str] = []

    for doc in cursor:
        scanned += 1
        name = (doc.get("agentName") or "").strip()
        old = (doc.get("agentPhone") or "").strip()
        resolved = best_contact_phone(name, contacts)
        new = format_agent_phone(resolved) if resolved else ""
        old_d = normalize_phone_digits(old)
        new_d = normalize_phone_digits(new)
        if old_d == new_d:
            continue
        changes[f"{old or '(empty)'} -> {new or '(clear)'}"] += 1
        if len(samples) < 25:
            samples.append(
                f"{doc.get('_id')} | {name} | {old or '(empty)'} -> {new or '(clear)'} | {doc.get('slug') or doc.get('title')}"
            )
        if new:
            ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": {"agentPhone": new}}))
        else:
            ops.append(UpdateOne({"_id": doc["_id"]}, {"$unset": {"agentPhone": ""}}))

    print(f"Mongo whatsapp-chat-import listings scanned: {scanned}")
    print(f"Mongo agentPhone updates: {len(ops)}")
    for line in samples:
        print(f"  {_safe(line)}")
    if changes:
        print("Mongo change patterns:")
        for k, v in changes.most_common(20):
            print(f"  {v:4d}  {_safe(k)}")

    if ops and not dry_run:
        result = col.bulk_write(ops, ordered=False)
        print(f"Mongo bulk_write modified: {result.modified_count}")

    client.close()
    return scanned, len(ops), changes


def _safe(s: object) -> str:
    return str(s).encode("ascii", "backslashreplace").decode("ascii")


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-mongo", action="store_true")
    parser.add_argument("--skip-files", action="store_true")
    args = parser.parse_args()

    if not ALL_CONTACTS.is_file():
        print(f"Missing {ALL_CONTACTS}", file=sys.stderr)
        sys.exit(1)

    contacts = load_contacts(ALL_CONTACTS)
    print(f"Contacts loaded: {len(contacts)} from {ALL_CONTACTS}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'WRITE'}")

    # Sanity: Property Valuation Services must not resolve to Property contact.
    pvs = best_contact_phone("Property Valuation Services", contacts)
    print(f'Check "Property Valuation Services" -> {pvs or "unknown"}')
    if pvs and "8064799407" in re.sub(r"\D", "", pvs):
        print("ERROR: matcher still maps Property Valuation Services to 8064799407", file=sys.stderr)
        sys.exit(1)

    total_changed = 0
    if not args.skip_files:
        targets: list[Path] = []
        if ALL_CHATS.is_file():
            targets.append(ALL_CHATS)
        for chat_txt in sorted(REPO.glob("WhatsApp Chat*/chat.txt")):
            targets.append(chat_txt)
        # Also common non-prefixed export folders
        for chat_txt in sorted(REPO.glob("WhatsAppChat*/chat.txt")):
            targets.append(chat_txt)
        for chat_txt in sorted(REPO.glob("1/chat.txt")):
            targets.append(chat_txt)

        # de-dupe paths
        uniq: list[Path] = []
        seen_paths: set[Path] = set()
        for p in targets:
            rp = p.resolve()
            if rp in seen_paths:
                continue
            seen_paths.add(rp)
            uniq.append(p)

        file_patterns: Counter[str] = Counter()
        for path in uniq:
            seen, changed, changes = rewrite_chat_file(path, contacts, args.dry_run)
            total_changed += changed
            file_patterns.update(changes)
            if changed:
                print(f"{_safe(path.relative_to(REPO))}: {changed}/{seen} headers updated")
        print(f"Chat files updated headers (total): {total_changed}")
        if file_patterns:
            print("Top file change patterns:")
            for k, v in file_patterns.most_common(25):
                print(f"  {v:4d}  {_safe(k)}")

    if not args.skip_mongo:
        repair_mongo(contacts, args.dry_run)

    print("Done.")


if __name__ == "__main__":
    main()
