import { LISTING_TYPE } from '@/lib/constants';

export type InferredTransactionalType = (typeof LISTING_TYPE)['SALE'] | (typeof LISTING_TYPE)['RENT'];

function inferRentPeriodFromText(text: string): 'day' | 'month' | 'year' {
  if (/\b(per\s*day|\/\s*day|daily)\b/i.test(text)) return 'day';
  if (/\b(per\s*month|p\.?\s*m\.?|monthly|\/\s*month)\b/i.test(text)) return 'month';
  return 'year';
}

/**
 * Infer sale vs. rent from title, description, and tags (aligned with WhatsApp import signals + common NG phrasing).
 * Returns null when copy looks like joint venture, when there is no clear signal, or when rent and sale conflict
 * without a clear winner in the title / first line.
 */
export function inferSaleOrRentFromPostCopy(parts: {
  title: string;
  description: string;
  tags?: string[];
}): { listingType: InferredTransactionalType; rentPeriod?: 'day' | 'month' | 'year' } | null {
  const title = (parts.title || '').trim();
  const description = (parts.description || '').trim();
  const tags = parts.tags || [];
  const full = [title, description, tags.join(' ')].join('\n');

  if (
    /\b(joint\s+venture|\bjv\b|jv\s+in|partnership\s+on\s+land|sharing\s+ratio|facilitator'?s?\s+fee)\b/i.test(
      full
    )
  ) {
    return null;
  }

  const rentRe =
    /\b(for\s*rent|to\s*rent|to\s*let|available\s*for\s*rent|short\s*let|shortlet|rental\b|renting\b)\b/i;
  const saleRe = /\b(for\s*sale|to\s*sell|available\s*for\s*sale|selling\b)\b/i;

  const hasRent = rentRe.test(full);
  const hasSale = saleRe.test(full);

  if (hasRent && hasSale) {
    const head = (title || full.split(/\n/)[0] || '').slice(0, 280);
    const rentIdx = head.search(rentRe);
    const saleIdx = head.search(saleRe);
    if (rentIdx < 0 && saleIdx >= 0) return { listingType: LISTING_TYPE.SALE };
    if (saleIdx < 0 && rentIdx >= 0) {
      return { listingType: LISTING_TYPE.RENT, rentPeriod: inferRentPeriodFromText(full) };
    }
    if (rentIdx >= 0 && saleIdx >= 0) {
      if (rentIdx < saleIdx) return { listingType: LISTING_TYPE.RENT, rentPeriod: inferRentPeriodFromText(full) };
      if (saleIdx < rentIdx) return { listingType: LISTING_TYPE.SALE };
      return null;
    }
    return null;
  }

  if (hasRent) {
    return { listingType: LISTING_TYPE.RENT, rentPeriod: inferRentPeriodFromText(full) };
  }
  if (hasSale) {
    return { listingType: LISTING_TYPE.SALE };
  }

  return null;
}
