import { formatListingTypeLabel, formatPropertyTypeLabel } from '@/lib/constants';
import { formatListingLocationDisplay } from '@/lib/listing-location';
import type { DescriptionInput } from '@/lib/listing-description';
import { formatPrice, escapeHtml, stripHtml } from '@/lib/utils';

export type HumanListingDescriptionInput = DescriptionInput & {
  title: string;
  /** Original paste or user text — facts are preserved where useful. */
  rawDescription?: string | null;
  amenities?: string[];
};

/** Plain-text descriptions shorter than this are rewritten to avoid thin/low-value pages. */
export const MIN_HUMAN_REWRITE_DESCRIPTION_LEN = 250;

/** True when plain-text description is shorter than the rewrite threshold. */
export function shouldHumanizeListingDescription(description: string | null | undefined): boolean {
  return stripHtml(description ?? '').trim().length < MIN_HUMAN_REWRITE_DESCRIPTION_LEN;
}

function hashPick<T>(key: string, items: T[]): T {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h << 5) - h + key.charCodeAt(i);
  return items[Math.abs(h) % items.length]!;
}

function typesLabel(input: HumanListingDescriptionInput): string {
  const types =
    input.propertyTypes?.length ? input.propertyTypes : input.propertyType ? [input.propertyType] : [];
  if (!types.length) return 'property';
  return types.map((t) => formatPropertyTypeLabel(t)).join(' and ');
}

function listingIntentPhrase(input: HumanListingDescriptionInput): string {
  const label = formatListingTypeLabel(input.listingType || 'sale');
  if (label === 'Rent') return 'for rent';
  if (label === 'Joint venture') return 'open to joint venture';
  return 'for sale';
}

function cleanRawFacts(raw: string): string {
  return stripHtml(raw).replace(/\r\n/g, '\n').replace(/\s{2,}/g, ' ').trim();
}

/** Pull readable fact sentences from messy paste text. */
function extractFactSentences(raw: string, max = 4): string[] {
  const cleaned = cleanRawFacts(raw);
  if (!cleaned) return [];

  const chunks = cleaned
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 320);

  const seen = new Set<string>();
  const out: string[] = [];

  for (let chunk of chunks) {
    chunk = chunk.replace(/^[-•*]\s*/, '');
    if (/^(price|asking|contact|call|dm|enquire)/i.test(chunk)) continue;
    const key = chunk.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sentenceCase(chunk));
    if (out.length >= max) break;
  }

  return out;
}

function sentenceCase(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatPriceLine(input: HumanListingDescriptionInput): string {
  const p = input.price;
  if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0) {
    return 'Price is available on request — contact the listing owner for the current asking figure.';
  }
  return `The asking price is ${formatPrice(p, input.listingType === 'rent' ? input.rentPeriod : undefined)}.`;
}

function detailSentence(input: HumanListingDescriptionInput): string | null {
  const bits: string[] = [];
  if ((input.bedrooms ?? 0) > 0) bits.push(`${input.bedrooms} bedroom${input.bedrooms === 1 ? '' : 's'}`);
  if ((input.bathrooms ?? 0) > 0) bits.push(`${input.bathrooms} bathroom${input.bathrooms === 1 ? '' : 's'}`);
  if ((input.toilets ?? 0) > 0) bits.push(`${input.toilets} toilet${input.toilets === 1 ? '' : 's'}`);
  if (input.area && input.area > 0) bits.push(`${input.area} sqm of space`);
  if (!bits.length) return null;
  return `It offers ${bits.join(', ')}.`;
}

function introParagraph(input: HumanListingDescriptionInput): string {
  const typeStr = typesLabel(input);
  const loc = formatListingLocationDisplay({
    address: input.locationLine,
    city: input.locationLine.split(',')[0],
    state: input.locationLine.split(',').pop(),
  }) || input.locationLine || 'Nigeria';
  const intent = listingIntentPhrase(input);
  const key = `${input.title}|${input.locationLine}|intro`;

  const variants = [
    `This ${typeStr.toLowerCase()} in ${loc} is listed ${intent}. It may suit buyers or tenants who want a clear summary before arranging a viewing.`,
    `Listed ${intent} on Digit Properties: a ${typeStr.toLowerCase()} in ${loc}. Below are the key details we have from the seller or agent.`,
    `If you are searching in ${loc}, this ${typeStr.toLowerCase()} is ${intent}. Take a moment to review the layout, price, and location notes before you reach out.`,
    `A ${typeStr.toLowerCase()} ${intent} in ${loc}. We have summarised the listing in plain language so you can decide quickly whether to book an inspection.`,
  ];

  return hashPick(key, variants);
}

function closingParagraph(input: HumanListingDescriptionInput): string {
  const key = `${input.title}|close`;
  const variants = [
    'We recommend a physical inspection to confirm plot size, access roads, and the condition of the building. Ask the listing owner about title documents and any service charges before you pay.',
    'Please visit the property in person where possible, and verify survey plans or title papers with a qualified professional before completing payment.',
    'Arrange a viewing at a time that suits you, and use the contact options on this page to speak directly with the person responsible for the listing.',
    'Digit Properties connects you with the listing owner or agent — no middleman on the platform. Confirm boundaries, utilities, and paperwork during your inspection.',
  ];
  return hashPick(key, variants);
}

/** Rewrite very short descriptions into readable, human HTML copy. */
export function buildHumanListingDescriptionHtml(input: HumanListingDescriptionInput): string {
  const parts: string[] = [];
  parts.push(`<p>${escapeHtml(introParagraph(input))}</p>`);

  const facts = extractFactSentences(input.rawDescription ?? input.title ?? '');
  if (facts.length) {
    parts.push(`<p>${escapeHtml(facts.join(' '))}</p>`);
  }

  const details = detailSentence(input);
  if (details) {
    parts.push(`<p>${escapeHtml(details)}</p>`);
  }

  parts.push(`<p>${escapeHtml(formatPriceLine(input))}</p>`);

  const amenities = (input.amenities ?? []).map((a) => a.trim()).filter(Boolean);
  if (amenities.length) {
    parts.push('<p><strong>Features noted in this listing</strong></p><ul>');
    for (const a of amenities.slice(0, 16)) {
      parts.push(`<li>${escapeHtml(a)}</li>`);
    }
    parts.push('</ul>');
  }

  const loc = escapeHtml((input.locationLine || '').trim() || 'Nigeria');
  parts.push(
    `<p><strong>Location</strong></p><p>The property is in <strong>${loc}</strong>. ${escapeHtml(closingParagraph(input))}</p>`
  );

  return parts.join('\n');
}

export function humanListingDescriptionInputFromDoc(doc: {
  title?: string;
  description?: string | null;
  price?: number;
  listingType?: string | null;
  rentPeriod?: 'day' | 'month' | 'year' | string | null;
  propertyType?: string | null;
  propertyTypes?: string[] | null;
  location?: { address?: string; suburb?: string; city?: string; state?: string } | null;
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  area?: number;
  amenities?: string[];
}): HumanListingDescriptionInput {
  return {
    title: String(doc.title ?? ''),
    rawDescription: doc.description,
    price: Number(doc.price) || 0,
    listingType: doc.listingType ?? 'sale',
    rentPeriod: (doc.rentPeriod as 'day' | 'month' | 'year' | undefined) ?? undefined,
    propertyType: doc.propertyType ?? 'apartment',
    propertyTypes: doc.propertyTypes ?? undefined,
    locationLine: formatListingLocationDisplay(doc.location ?? undefined),
    bedrooms: doc.bedrooms ?? 0,
    bathrooms: doc.bathrooms ?? 0,
    toilets: doc.toilets,
    area: doc.area,
    amenities: doc.amenities,
  };
}
