/**
 * Listing list URL/query helpers (safe for client components — no Mongoose).
 */
import type { ListingSortKey } from '@/lib/sort-listing-rows';

const VALID_SORT: ListingSortKey[] = ['default', 'image', 'date', 'title', 'price', 'status'];

export function parseListingSortFromSearchParams(sp: {
  sort?: string | string[];
  order?: string | string[];
}): { sortKey: ListingSortKey; sortAsc: boolean } {
  const sortRaw = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const orderRaw = Array.isArray(sp.order) ? sp.order[0] : sp.order;

  let sortKey: ListingSortKey = 'default';
  if (sortRaw && VALID_SORT.includes(sortRaw as ListingSortKey)) {
    sortKey = sortRaw as ListingSortKey;
  }
  if (sortKey === 'default') {
    return { sortKey: 'default', sortAsc: true };
  }
  let sortAsc: boolean;
  if (orderRaw === 'desc') sortAsc = false;
  else if (orderRaw === 'asc') sortAsc = true;
  else sortAsc = sortKey === 'image' || sortKey === 'date' ? false : true;
  return { sortKey, sortAsc };
}

/** Query string for list pages (pagination + optional sort). */
export function buildListingListQuery(
  page: number,
  sortKey: ListingSortKey,
  sortAsc: boolean
): string {
  const p = new URLSearchParams();
  if (page > 1) p.set('page', String(page));
  if (sortKey !== 'default') {
    p.set('sort', sortKey);
    p.set('order', sortAsc ? 'asc' : 'desc');
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
