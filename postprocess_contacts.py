from pathlib import Path

import importlib.util


spec = importlib.util.spec_from_file_location("m", "extract_whatsapp_contacts.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

contacts_path = Path(r"C:\Users\User\Desktop\Digit-Properties\contacts.txt")

rows = []
for ln in contacts_path.read_text(encoding="utf-8", errors="ignore").splitlines():
    if not ln.strip():
        continue
    if "\t" not in ln:
        continue
    name, phone = ln.split("\t", 1)
    name2 = m.clean_name(name)
    if name2:
        rows.append((name2, phone.strip()))

rows.sort(key=lambda x: x[0].lower())

with open(contacts_path, "w", encoding="utf-8") as f:
    for name, phone in rows:
        f.write(f"{name}\t{phone}\n")

print(f"Post-processed {len(rows)} contacts: {contacts_path}")

