/** Trimmed slug only — empty when missing (sitemap / canonical must not use ObjectId). */
export function getListingSlugSegment(listing: { slug?: string | null }): string {
  return typeof listing.slug === 'string' ? listing.slug.trim() : '';
}

/** Public listing URL segment (slug preferred, ObjectId fallback for internal links). */
export function getListingPathSegment(listing: { _id?: string | { toString(): string }; slug?: string | null }): string {
  const slug = getListingSlugSegment(listing);
  if (slug) return slug;
  const id = listing._id;
  if (id == null) return '';
  return typeof id === 'string' ? id : id.toString();
}

export function getListingPublicPath(listing: { _id?: string | { toString(): string }; slug?: string | null }): string {
  const segment = getListingPathSegment(listing);
  return segment ? `/listings/${segment}` : '/listings';
}
