"""
Merge every WhatsApp export _chat.txt under the repo into all_raw_chats.txt.

Each message header is rewritten to include a contact phone:
  [date, time] ~ <display name> ~ (<phone>):

Phone lookup uses the export folder's contacts.txt when present, otherwise
repo-root All_contacts.txt. Unmatched senders fall back to the global list.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent
ALL_CONTACTS = REPO / "All_contacts.txt"
OUT = REPO / "all_raw_chats.txt"

if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from build_chat import (
    HEADER_RE,
    best_contact_phone,
    display_name_raw,
    load_contacts,
    normalize_name,
)

PHONE_IN_HEADER_RE = re.compile(r"~\s*\([^)]+\):\s*")


class ContactResolver:
    def __init__(self, local_contacts: list[tuple[str, str]], global_contacts: list[tuple[str, str]]):
        self.combined = self._merge_contacts(local_contacts, global_contacts)
        self.cache: dict[str, str] = {}

    @staticmethod
    def _merge_contacts(
        local_contacts: list[tuple[str, str]],
        global_contacts: list[tuple[str, str]],
    ) -> list[tuple[str, str]]:
        seen: set[str] = set()
        merged: list[tuple[str, str]] = []
        for name, phone in local_contacts + global_contacts:
            key = normalize_name(name)
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append((name, phone))
        return merged

    def lookup(self, sender: str) -> str:
        label = display_name_raw(sender)
        key = normalize_name(label)
        if key in self.cache:
            return self.cache[key]

        phone = best_contact_phone(sender, self.combined) or "unknown"
        self.cache[key] = phone
        return phone


def format_message_with_phone(buf: list[str], resolver: ContactResolver) -> str:
    first = buf[0]
    if PHONE_IN_HEADER_RE.search(first):
        return "".join(buf)

    match = HEADER_RE.match(first)
    if not match:
        return "".join(buf)

    dt_s = match.group("dt")
    name_raw = match.group("name")
    body = match.group("body")
    label = display_name_raw(name_raw)
    phone = resolver.lookup(name_raw)

    bracket_ts = "[" + dt_s + "]"
    if body.strip():
        head = f"{bracket_ts} ~ {label} ~ ({phone}): {body}\n"
    else:
        head = f"{bracket_ts} ~ {label} ~ ({phone}):\n"
    return head + "".join(buf[1:])


def process_chat_file(chat_path: Path, resolver: ContactResolver, out_fp) -> tuple[int, int]:
    buf: list[str] = []
    messages = 0
    unknown = 0

    with chat_path.open("r", encoding="utf-8", errors="replace") as fin:
        for raw in fin:
            if HEADER_RE.match(raw):
                if buf:
                    text = format_message_with_phone(buf, resolver)
                    out_fp.write(text)
                    messages += 1
                    if text.splitlines()[0].endswith("~ (unknown):") or " ~ (unknown): " in text.splitlines()[0]:
                        unknown += 1
                buf = [raw]
            elif buf:
                buf.append(raw)
            else:
                out_fp.write(raw)

        if buf:
            text = format_message_with_phone(buf, resolver)
            out_fp.write(text)
            messages += 1
            if text.splitlines()[0].endswith("~ (unknown):") or " ~ (unknown): " in text.splitlines()[0]:
                unknown += 1

    return messages, unknown


def main() -> None:
    global_contacts = load_contacts(ALL_CONTACTS) if ALL_CONTACTS.is_file() else []
    chat_files = sorted(REPO.glob("WhatsApp Chat*/_chat.txt"), key=lambda p: p.parent.name.lower())

    if not chat_files:
        print("No _chat.txt files found.", file=sys.stderr)
        sys.exit(1)

    total_messages = 0
    total_unknown = 0

    with OUT.open("w", encoding="utf-8", newline="\n") as out_fp:
        for chat_path in chat_files:
            folder = chat_path.parent
            local_path = folder / "contacts.txt"
            local_contacts = load_contacts(local_path) if local_path.is_file() else []
            source = "contacts.txt" if local_contacts else "all_contacts.txt"
            resolver = ContactResolver(local_contacts, global_contacts)

            out_fp.write(f"===== {folder.name} =====\n")
            messages, unknown = process_chat_file(chat_path, resolver, out_fp)
            out_fp.write("\n")

            total_messages += messages
            total_unknown += unknown
            print(
                f"{folder.name}: {messages} messages, {unknown} unknown phones "
                f"(contacts from {source}, local={len(local_contacts)}, global={len(global_contacts)})"
            )

    print(f"\nWrote {OUT}")
    print(f"Folders: {len(chat_files)}")
    print(f"Messages: {total_messages}")
    print(f"Unknown phones: {total_unknown}")


if __name__ == "__main__":
    main()
