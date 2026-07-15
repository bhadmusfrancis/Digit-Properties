"""Merge every contacts.txt under the repo into All_contacts.txt (deduped by phone)."""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parent
OUT = REPO / "All_contacts.txt"


def phone_key(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    return digits or phone.lower()


def main() -> None:
    seen: dict[str, tuple[str, str]] = {}
    for path in sorted(REPO.rglob("contacts.txt")):
        if path.name != "contacts.txt":
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line or "\t" not in line:
                continue
            name, phone = line.split("\t", 1)
            name, phone = name.strip(), phone.strip()
            if not name or not phone:
                continue
            key = phone_key(phone)
            prev = seen.get(key)
            if prev is None or len(name) > len(prev[0]):
                seen[key] = (name, phone)
    rows = sorted(seen.values(), key=lambda r: (r[0].lower(), r[1]))
    OUT.write_text(
        "\n".join(f"{n}\t{p}" for n, p in rows) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"Wrote {OUT} ({len(rows)} unique contacts)")


if __name__ == "__main__":
    main()
