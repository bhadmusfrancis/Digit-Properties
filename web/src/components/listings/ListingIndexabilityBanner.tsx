import Link from 'next/link';
import { SystemNotice } from '@/components/ui/SystemNotice';
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
    <SystemNotice kind="info" title="Not visible in Google search yet">
      <p>
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
    </SystemNotice>
  );
}
