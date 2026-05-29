import { isVideoUrl } from '@/lib/listing-default-image';
import { siteOrigin } from '@/lib/site-metadata';

/** Direct listing photo URLs (excludes playable videos and duplicates). */
export function collectListingPhotoUrls(
  images: { url?: string }[] | undefined,
  opts?: { max?: number }
): string[] {
  const max = opts?.max ?? 24;
  const seen = new Set<string>();
  const out: string[] = [];

  for (const img of images ?? []) {
    const raw = typeof img?.url === 'string' ? img.url.trim() : '';
    if (!raw || isVideoUrl(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

export function toAbsoluteImageUrlForSeo(raw: string): string {
  const u = raw.trim();
  if (!u) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  const origin = siteOrigin();
  return `${origin}${u.startsWith('/') ? u : `/${u}`}`;
}
