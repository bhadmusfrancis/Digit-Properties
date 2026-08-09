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
            parts = [p.strip() for p in line.split("\t")]
            if len(parts) < 2:
                continue
            name, phone = parts[0].lstrip("\ufeff"), parts[1]
            new_name = parts[2].lstrip("\ufeff") if len(parts) >= 3 and parts[2] else ""
            if not name or not phone:
                continue
            key = phone_key(phone)
            prev = seen.get(key)
            # Prefer row that keeps a rename (old+new), else longer primary name
            cand = (name, phone, new_name)
            if prev is None:
                seen[key] = cand
            else:
                prev_new = prev[2]
                if new_name and not prev_new:
                    seen[key] = cand
                elif len(name) > len(prev[0]) and (bool(new_name) == bool(prev_new)):
                    seen[key] = cand
    rows = sorted(seen.values(), key=lambda r: (r[0].lower(), r[1]))
    out_lines: list[str] = []
    for n, p, nn in rows:
        if nn:
            out_lines.append(f"{n}\t{p}\t{nn}")
        else:
            out_lines.append(f"{n}\t{p}")
    OUT.write_text(
        "\n".join(out_lines) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"Wrote {OUT} ({len(rows)} unique contacts)")


if __name__ == "__main__":
    main()
