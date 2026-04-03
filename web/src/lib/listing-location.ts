/**
 * One line for cards and detail sidebars. Prefer structured suburb/city/state so we
 * do not repeat place names that are usually already inside the free-text address.
 */
export function formatListingLocationDisplay(loc: {
  address?: string | null;
  suburb?: string | null;
  city?: string | null;
  state?: string | null;
} | null | undefined): string {
  if (!loc || typeof loc !== 'object') return '';
  const structured = [loc.suburb, loc.city, loc.state]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0);
  if (structured.length > 0) {
    return Array.from(new Map(structured.map((p) => [p.toLowerCase(), p])).values()).join(', ');
  }
  const addr = typeof loc.address === 'string' ? loc.address.trim() : '';
  return addr;
}
