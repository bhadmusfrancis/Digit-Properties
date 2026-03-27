export function normalizeList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function mergeUniqueLists(...lists: Array<string[] | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const value of normalizeList(list)) {
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect amenities mentioned in free text, using a known list as dictionary.
 * Matching is case-insensitive and tries to avoid partial-word matches.
 */
export function extractAmenitiesFromText(text: string | undefined, known: readonly string[]) {
  if (!text || typeof text !== 'string') return [];
  const t = text.toLowerCase();
  const matches: string[] = [];
  for (const a of known) {
    if (!a || typeof a !== 'string') continue;
    const needle = a.trim();
    if (!needle) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle.toLowerCase())}([^a-z0-9]|$)`, 'i');
    if (re.test(t)) matches.push(needle);
  }
  return matches;
}
