'use client';

import { ListingForm, type ListingFormProps } from '@/components/listings/ListingForm';

/** Client boundary for the listing editor (keeps TipTap/maps off the RSC graph). */
export function EditListingFormLoader(props: ListingFormProps) {
  return <ListingForm {...props} />;
}
