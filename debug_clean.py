import importlib.util

spec = importlib.util.spec_from_file_location("m", "extract_whatsapp_contacts.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

s = "e ) ~'‘deji Fashola"
print("RAW:", repr(s))
print("CLEAN:", repr(m.clean_name(s)))

s2 = "& Tunde Johnson Consulting"
print("RAW2:", repr(s2))
print("CLEAN2:", repr(m.clean_name(s2)))

