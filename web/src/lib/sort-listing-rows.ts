/** Shared client-side sort for listing tables (My Properties, Admin listings). */

export type ListingSortKey = 'default' | 'image' | 'date' | 'title' | 'price' | 'status';

export type SortableListingFields = {
  title: string;
  price: number;
  status: string;
  images?: { url?: string; public_id?: string }[];
  videos?: { url?: string; public_id?: string }[];
};

export const LISTING_STATUS_SORT_RANK: Record<string, number> = {
  draft: 0,
  pending_approval: 1,
  active: 2,
  paused: 3,
  closed: 4,
};

/** Next sort state when user clicks a column (matches table header UX). */
export function cycleListingSort(
  prevKey: ListingSortKey,
  prevAsc: boolean,
  clickedKey: Exclude<ListingSortKey, 'default'>
): { sortKey: ListingSortKey; sortAsc: boolean } {
  if (prevKey !== clickedKey) {
    // Default click order: images/newest-first should start descending.
    if (clickedKey === 'image' || clickedKey === 'date') return { sortKey: clickedKey, sortAsc: false };
    return { sortKey: clickedKey, sortAsc: true };
  }
  return { sortKey: prevKey, sortAsc: !prevAsc };
}

export function sortListingRows<T extends SortableListingFields>(
  rows: T[],
  sortKey: ListingSortKey,
  sortAsc: boolean
): T[] {
  if (sortKey === 'default') return [...rows];
  const copy = [...rows];
  const dir = sortAsc ? 1 : -1;
  copy.sort((a, b) => {
    switch (sortKey) {
      case 'image': {
        const hasMedia = (x: SortableListingFields) =>
          !!(x.images?.[0]?.url?.trim()) ||
          !!(x.videos?.[0]?.url?.trim() || x.videos?.[0]?.public_id?.trim());
        const ha = hasMedia(a) ? 1 : 0;
        const hb = hasMedia(b) ? 1 : 0;
        if (ha !== hb) return (ha - hb) * dir;
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
      case 'title':
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) * dir;
      case 'price':
        if (a.price !== b.price) return (a.price - b.price) * dir;
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      case 'status': {
        const ra = LISTING_STATUS_SORT_RANK[a.status] ?? 99;
        const rb = LISTING_STATUS_SORT_RANK[b.status] ?? 99;
        if (ra !== rb) return (ra - rb) * dir;
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
      default:
        return 0;
    }
  });
  return copy;
}
