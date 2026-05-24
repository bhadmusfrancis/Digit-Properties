/** Lowercase URL slug from display text (shared by listings, trends, locations). */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Append numeric suffix until `isAvailable` returns true. */
export async function uniqueSlug(
  base: string,
  isAvailable: (candidate: string) => Promise<boolean>
): Promise<string> {
  const root = base || 'item';
  let candidate = root;
  let n = 0;
  while (!(await isAvailable(candidate))) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}
