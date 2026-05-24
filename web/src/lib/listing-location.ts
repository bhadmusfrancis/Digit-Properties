/**
 * One line for cards, detail sidebars, and generated listing titles.
 * Order: suburb, then city, then state. Free-text address is used only when
 * structured fields are empty.
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
