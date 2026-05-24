/** Public listing URL segment (slug preferred, ObjectId fallback). */
export function getListingPathSegment(listing: { _id?: string | { toString(): string }; slug?: string | null }): string {
  const slug = typeof listing.slug === 'string' ? listing.slug.trim() : '';
  if (slug) return slug;
  const id = listing._id;
  if (id == null) return '';
  return typeof id === 'string' ? id : id.toString();
}

export function getListingPublicPath(listing: { _id?: string | { toString(): string }; slug?: string | null }): string {
  const segment = getListingPathSegment(listing);
  return segment ? `/listings/${segment}` : '/listings';
}
