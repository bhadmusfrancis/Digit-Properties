import Link from 'next/link';
import {
  MIN_INDEXABLE_DESCRIPTION_CHARS,
  getListingIndexabilityGap,
  listingHasOwnMedia,
  type IndexableListingInput,
} from '@/lib/seo/listing-indexability';

type Props = IndexableListingInput & {
  editHref: string;
};

/** Owner-only hint when a listing is too thin for Google to index. */
export function ListingIndexabilityBanner(props: Props) {
  const { editHref, ...input } = props;
  const gap = getListingIndexabilityGap(input);
  if (gap.indexable) return null;

  return (
    <div
      className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
      role="status"
    >
      <p className="font-semibold text-sky-900">Not visible in Google search yet</p>
      <p className="mt-1 text-sky-900">
        Upload your own photos or a property video, or write at least {MIN_INDEXABLE_DESCRIPTION_CHARS}{' '}
        characters of unique description text. Listings with only the default placeholder image and short
        copy are kept out of search results to avoid duplicate-content issues.
        {!listingHasOwnMedia(input) && gap.descriptionCharsNeeded > 0 ?
          ` Your description is ${gap.descriptionCharCount} characters (${gap.descriptionCharsNeeded} more needed without photos).`
        : null}
      </p>
      <Link href={editHref} className="mt-2 inline-block font-medium text-sky-800 underline hover:text-sky-950">
        Edit listing to improve visibility
      </Link>
    </div>
  );
}
