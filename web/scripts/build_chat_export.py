"""
Build chat.txt from _chat.txt in a WhatsApp export folder.

Requires in the same folder:
  - _chat.txt
  - contacts.txt   (only this contacts file is used — not from other groups)

Cutoff for new messages: last timestamp in repo-root All_chats.txt (if present),
else processes all messages from DEFAULT_CUTOFF onward.

Usage (from web/):
  python scripts/build_chat_export.py --dir "../WhatsApp Chat - NIGERIA MARKET"
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
BUILD_MODULE_DIR = REPO / "WhatsApp Chat - WORLD MARKET"
ALL_CHATS = REPO / "All_chats.txt"

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
        help="Export folder containing _chat.txt and contacts.txt",
    )
    args = parser.parse_args()

    base = Path(args.dir).resolve()
    src = base / "_chat.txt"
    cpath = base / "contacts.txt"
    out = base / "chat.txt"

    if not src.is_file():
        print(f"Missing {src}", file=sys.stderr)
        sys.exit(1)
    if not cpath.is_file():
        print(f"Missing {cpath} (contacts must be in the same folder as _chat.txt)", file=sys.stderr)
        sys.exit(1)

    cutoff = cutoff_from_all_chats()
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
    print(f"Contacts: {cpath}")
    print(f"Dedup basis (cutoff from All_chats.txt): {cutoff.isoformat(sep=' ')}")
    print(f"Messages after real-estate filter: {before}")
    print(f"Similar duplicates removed (keeping first): {n_drop_sim}")
    print(f"Final messages: {len(deduped)}")
    if unmatched:
        print("Senders with no contact match (count):", len(unmatched))


if __name__ == "__main__":
    main()
