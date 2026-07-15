"""
Build chat.txt from _chat.txt in a WhatsApp export folder.

Requires:
  - _chat.txt in the export folder
  - repo-root All_contacts.txt (merged contacts for all groups)

Cutoff for new messages: last timestamp in repo-root All_chats.txt (if present),
else processes all messages from DEFAULT_CUTOFF onward.

For a brand-NEW group whose history predates everything already in All_chats.txt,
pass --all (process the whole export from DEFAULT_CUTOFF) or --since YYYY-MM-DD to
override the All_chats.txt cutoff. Duplicates are still removed downstream (the
importer dedupes each message against All_chats.txt and the DB fingerprints).

Usage (from web/):
  python scripts/build_chat_export.py --dir "../WhatsApp Chat - NIGERIA MARKET"
  python scripts/build_chat_export.py --dir "../WhatsApp Chat - MISGRAM NIG LTD" --all
  python scripts/build_chat_export.py --dir "../WhatsApp Chat - X" --since 2026-05-01
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
BUILD_MODULE_DIR = REPO / "WhatsApp Chat - WORLD MARKET"
ALL_CHATS = REPO / "All_chats.txt"
ALL_CONTACTS = REPO / "All_contacts.txt"

if str(BUILD_MODULE_DIR) not in sys.path:
    sys.path.insert(0, str(BUILD_MODULE_DIR))

from build_chat import (  # type: ignore
    DEFAULT_CUTOFF,
    HEADER_RE,
    dedupe_similar_posts,
    format_message_if_kept,
    load_contacts,
    parse_whatsapp_dt,
)


def cutoff_from_all_chats() -> datetime:
    if not ALL_CHATS.is_file():
        return DEFAULT_CUTOFF
    last_dt: datetime | None = None
    for line in ALL_CHATS.read_text(encoding="utf-8", errors="replace").splitlines():
        m = HEADER_RE.match(line)
        if not m:
            continue
        dt = parse_whatsapp_dt(m.group("dt"))
        if dt is None:
            continue
        if last_dt is None or dt > last_dt:
            last_dt = dt
    return last_dt if last_dt is not None else DEFAULT_CUTOFF


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dir",
        required=True,
        help="Export folder containing _chat.txt",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process the whole export from DEFAULT_CUTOFF (for a brand-new group), "
        "ignoring the All_chats.txt cutoff.",
    )
    parser.add_argument(
        "--since",
        metavar="YYYY-MM-DD",
        help="Override cutoff with this date instead of the All_chats.txt cutoff.",
    )
    args = parser.parse_args()

    base = Path(args.dir).resolve()
    src = base / "_chat.txt"
    out = base / "chat.txt"

    if not src.is_file():
        print(f"Missing {src}", file=sys.stderr)
        sys.exit(1)
    if not ALL_CONTACTS.is_file():
        print(
            f"Missing {ALL_CONTACTS} (merge all contacts.txt into All_contacts.txt first)",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.since:
        try:
            cutoff = datetime.strptime(args.since, "%Y-%m-%d")
        except ValueError:
            print(f"Invalid --since date {args.since!r}; expected YYYY-MM-DD", file=sys.stderr)
            sys.exit(1)
    elif args.all:
        cutoff = DEFAULT_CUTOFF
    else:
        cutoff = cutoff_from_all_chats()
    contacts = load_contacts(ALL_CONTACTS)
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
    print(f"Contacts: {ALL_CONTACTS} ({len(contacts)} entries)")
    print(f"Dedup basis (cutoff from All_chats.txt): {cutoff.isoformat(sep=' ')}")
    print(f"Messages after real-estate filter: {before}")
    print(f"Similar duplicates removed (keeping first): {n_drop_sim}")
    print(f"Final messages: {len(deduped)}")
    if unmatched:
        print("Senders with no contact match (count):", len(unmatched))


if __name__ == "__main__":
    main()
