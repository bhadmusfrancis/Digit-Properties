export function toFirstName(firstName?: string | null, fullName?: string | null, fallback = 'User'): string {
  const f = (firstName ?? '').trim();
  if (f) return f.split(/\s+/)[0] ?? fallback;

  const n = (fullName ?? '').trim();
  if (!n) return fallback;
  return n.split(/\s+/)[0] ?? fallback;
}
