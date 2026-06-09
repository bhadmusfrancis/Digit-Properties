import { getListingPublicPath, getListingPathSegment } from '@/lib/listing-path';
import { siteOrigin } from '@/lib/site-metadata';

export type ListingEmailRef = {
  id: string;
  slug?: string | null;
  title?: string;
};

/** Absolute public listing URL (prefers slug over ObjectId). */
export function buildListingEmailUrl(ref: ListingEmailRef): string {
  const origin = siteOrigin();
  const path = getListingPublicPath({ _id: ref.id, slug: ref.slug });
  return `${origin}${path}`;
}

export function listingEmailVars(ref: ListingEmailRef) {
  const listingPath = getListingPublicPath({ _id: ref.id, slug: ref.slug });
  const listingUrl = buildListingEmailUrl(ref);
  return {
    listingTitle: ref.title?.trim() || 'Property listing',
    listingId: getListingPathSegment({ _id: ref.id, slug: ref.slug }),
    listingUrl,
    listingEditUrl: `${listingUrl}/edit`,
    listingPath,
  };
}

/** Standard “View listing” block for notification emails. */
export function listingLinkParagraph(
  listingUrl: string,
  options?: { editUrl?: string; viewLabel?: string }
): string {
  const viewLabel = options?.viewLabel ?? 'View listing';
  const view = `<a href="${listingUrl}" style="color: #0d9488; font-weight: 600; text-decoration: underline;">${viewLabel}</a>`;
  if (options?.editUrl) {
    return `<p>${view} · <a href="${options.editUrl}" style="color: #0d9488; text-decoration: underline;">Edit listing</a></p>`;
  }
  return `<p>${view}</p>`;
}
