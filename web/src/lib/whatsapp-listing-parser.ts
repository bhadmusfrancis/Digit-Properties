/**
 * Parse unstructured property text (e.g. from WhatsApp group/status) into
 * Digit Properties listing payload. Used by "Import from WhatsApp" flow.
 */
import { NIGERIAN_STATES, PROPERTY_TYPES, LISTING_TYPE, RESIDENTIAL_PROPERTY_TYPES } from './constants';
import { buildCanonicalListingTitle } from '@/lib/listing-title';
import { resolveNigeriaPlaceFromText, detectNigerianStateInText } from '@/lib/nigeria-place-resolve';

export type ParsedListing = {
  title: string;
  description: string;
  listingType: (typeof LISTING_TYPE)[keyof typeof LISTING_TYPE];
  propertyType: string;
  price: number;
  location: { address: string; city: string; state: string; suburb?: string };
  bedrooms: number;
  bathrooms: number;
  toilets?: number;
  /** Area in square meters (parsed from e.g. 500sqm, 1,634sqm) */
  area?: number;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  rentPeriod?: 'day' | 'month' | 'year';
  amenities: string[];
  tags: string[];
};

export type ParseResult = {
  parsed: ParsedListing;
  confidence: 'high' | 'medium' | 'low';
  missing: string[];
};

/** Sender info when import is from WhatsApp Business API webhook */
export type SenderDetails = {
  name?: string;
  phone?: string;
  waId?: string;
};

/** Parsed listing with optional media URLs (from webhook) */
export type ParsedListingWithMeta = ParseResult & {
  /** Media URLs from the same message (images/videos) */
  mediaUrls?: string[];
};

const STATE_ALIASES: Record<string, string> = {
  'fct': 'FCT', 'abuja': 'FCT',
  'lagos': 'Lagos', 'rivers': 'Rivers', 'ph': 'Rivers', 'portharcourt': 'Rivers',
  'oyo': 'Oyo', 'ibadan': 'Oyo', 'ogun': 'Ogun',
};
const COMMON_AREAS: Record<string, { city: string; state: string }> = {
  'lekki': { city: 'Lekki', state: 'Lagos' },
  'ikeja': { city: 'Ikeja', state: 'Lagos' },
  'victoria island': { city: 'Victoria Island', state: 'Lagos' },
  'vi': { city: 'Victoria Island', state: 'Lagos' },
  'ajah': { city: 'Ajah', state: 'Lagos' },
  'ikota': { city: 'Ikota', state: 'Lagos' },
  'ikoyi': { city: 'Ikoyi', state: 'Lagos' },
  'yaba': { city: 'Yaba', state: 'Lagos' },
  'surulere': { city: 'Surulere', state: 'Lagos' },
  'gbagada': { city: 'Gbagada', state: 'Lagos' },
  'maryland': { city: 'Maryland', state: 'Lagos' },
  'ilupeju': { city: 'Ilupeju', state: 'Lagos' },
  'lagos island': { city: 'Lagos Island', state: 'Lagos' },
  'abuja': { city: 'Abuja', state: 'FCT' },
  'maitama': { city: 'Maitama', state: 'FCT' },
  'garki': { city: 'Garki', state: 'FCT' },
  'wuse': { city: 'Wuse', state: 'FCT' },
  'asokoro': { city: 'Asokoro', state: 'FCT' },
  'port harcourt': { city: 'Port Harcourt', state: 'Rivers' },
  'ph city': { city: 'Port Harcourt', state: 'Rivers' },
  'banana island': { city: 'Ikoyi', state: 'Lagos' },
  'oniru': { city: 'Oniru', state: 'Lagos' },
  'katampe extension': { city: 'Katampe', state: 'FCT' },
  'katampe': { city: 'Katampe', state: 'FCT' },
  'games village': { city: 'Kaura', state: 'FCT' },
  'area one': { city: 'Garki', state: 'FCT' },
  'mojisola onikoyi': { city: 'Ikoyi', state: 'Lagos' },
  'igbo efon': { city: 'Lekki', state: 'Lagos' },
  'chevron': { city: 'Lekki', state: 'Lagos' },
  'jakande': { city: 'Lekki', state: 'Lagos' },
  'osbourne phase 2': { city: 'Ikoyi', state: 'Lagos' },
  'osbourne': { city: 'Ikoyi', state: 'Lagos' },
  'old ikoyi': { city: 'Ikoyi', state: 'Lagos' },
  'isheri-oshun': { city: 'Isheri-Oshun', state: 'Lagos' },
  'isheri oshun': { city: 'Isheri-Oshun', state: 'Lagos' },
  'isheri': { city: 'Isheri-Oshun', state: 'Lagos' },
  'akute': { city: 'Akute', state: 'Ogun' },
  'jolasco': { city: 'Akute', state: 'Ogun' },
  'tipper garage': { city: 'Akute', state: 'Ogun' },
  'sangotedo': { city: 'Sangotedo', state: 'Lagos' },
  'festac': { city: 'Festac', state: 'Lagos' },
  'ikotun': { city: 'Ikotun', state: 'Lagos' },
  'igbesa': { city: 'Igbesa', state: 'Ogun' },
  'agbara': { city: 'Agbara', state: 'Ogun' },
  'ado odo': { city: 'Ado-Odo', state: 'Ogun' },
  'ijanikin': { city: 'Ijanikin', state: 'Lagos' },
  'sango otta': { city: 'Sango Ota', state: 'Ogun' },
  'ijebu east': { city: 'Ijebu', state: 'Ogun' },
  'ishaga': { city: 'Ishaga', state: 'Lagos' },
  'elliott': { city: 'Ishaga', state: 'Lagos' },
  'ketu': { city: 'Ketu', state: 'Lagos' },
  'ibafo': { city: 'Ibafo', state: 'Ogun' },
  'ibadan': { city: 'Ibadan', state: 'Oyo' },
  'mokola': { city: 'Ibadan', state: 'Oyo' },
};

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim();
}

/**
 * Leading WhatsApp chat-export message header, e.g.
 *   `[5/19/26, 4:00:33 AM] ~ ~ Engr Otaoghene(COREN) ~ (+234 706 735 0185): `
 *   `[3/19/26, 6:22:33 PM] ~ ESV Abiodun Mabel Kups ~ (+234 803 778 1974): `
 *   `[6:02 AM, 3/3/2026] +234 806 121 7377: `
 * The bracketed date/time may contain colons (e.g. 4:00:33), so they are kept
 * inside the `[^\]]*` group; stripping then runs up to the first colon that
 * terminates the sender metadata, preserving the actual message body.
 */
const CHAT_HEADER_PREFIX_RE = /^\s*\[\d{1,2}\/\d{1,2}\/\d{2,4}[^\]]*\][^:\n]*:[ \t]?/;
/** Sender header that lost its date prefix, e.g. `~ ~ Name ~ (+234 …): ` or `~ Name ~ (unknown): `. */
const TILDE_SENDER_PREFIX_RE = /^\s*(?:~[ \t]*)+[^:\n]*\([ \t]*(?:\+?\d[\d ]*|unknown)[ \t]*\)[ \t]*:[ \t]?/i;

/**
 * Remove WhatsApp chat-export artifacts (message headers with timestamps,
 * sender names and phone numbers, attachment markers) that must never appear
 * in a public listing description. Operates line-by-line so it works on both
 * multi-line raw text and already-flattened single-line stored descriptions.
 */
export function stripChatArtifacts(raw: string): string {
  if (!raw) return raw;
  const withoutMarkers = raw
    .replace(/<attached:[^>]*>/gi, ' ')
    .replace(/<\s*media omitted\s*>/gi, ' ')
    .replace(/\b(?:image|video|audio|gif|sticker|document|contact card|location)\s+omitted\b/gi, ' ')
    .replace(/\u200e/g, '');

  const cleanedLines = withoutMarkers.split(/\r?\n/).map((line) =>
    line.replace(CHAT_HEADER_PREFIX_RE, '').replace(TILDE_SENDER_PREFIX_RE, '')
  );

  return cleanedLines
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Nigerian phone tokens embedded in marketing copy (not property prices). */
const EMBEDDED_PHONE_TOKEN_RE =
  /\+\s*234[\s.\-]?\d{3}[\s.\-]?\d{3}[\s.\-]?\d{3,5}|\b0[789]\d{9,11}\b|\b234[789]\d{9,11}\b/gi;

/** Asterisk-wrapped phone lists, e.g. *07065628500,08058687903.* */
const PHONE_IN_ASTERISK_BLOCK_RE =
  /\*[\s,.\-;:|]*(?:(?:\+\s*234[\s.\-]?\d{3}[\s.\-]?\d{3}[\s.\-]?\d{3,5}|\b0[789]\d{9,11}\b|\b234[789]\d{9,11}\b)[\s,.\-;:|]*)+\*\.?/gi;

/**
 * Remove phone numbers from public listing copy (titles/descriptions).
 * Contact details belong in agentPhone/agentName fields, not body text.
 */
export function stripContactPhonesFromText(raw: string): string {
  if (!raw) return raw;

  let t = raw.replace(PHONE_IN_ASTERISK_BLOCK_RE, '*.*');
  t = t.replace(EMBEDDED_PHONE_TOKEN_RE, '');
  // Trailing orphaned contact tails after numbers were removed
  t = t.replace(
    /\b(?:for\s+)?(?:viewing\s*\/)?(?:further\s+)?inquir(?:y|ies)\s*,?\s*(?:pls\s+|please\s+)?call\s+[A-Za-z][A-Za-z\s]{1,40}\s*$/gim,
    ''
  );
  t = t.replace(
    /\b(?:pls\s+|please\s+)?(?:call|contact|whatsapp|tel|phone|mobile|reach(?:\s+us)?)(?:\s+on)?\s*[.,*]*\s*$/gim,
    ''
  );
  t = t.replace(/\bon\s*[.,]+\s*$/gim, '');
  t = t.replace(/,\s*,/g, ',');
  t = t.replace(/[ \t]+\n/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/\s+([.,])/g, '$1');
  t = t.replace(/\.\s*\./g, '.');
  return t.trim();
}

/** Preserve WhatsApp line breaks and punctuation while stripping export artifacts. */
export function prepareWhatsAppListingDescription(raw: string): string {
  const stripped = stripChatArtifacts(raw)
    .replace(/\r\n/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return stripContactPhonesFromText(stripped);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strict token/phrase match: prevents false hits like "vi" inside "available". */
function includesPhrase(haystack: string, phrase: string): boolean {
  const compact = phrase.trim().toLowerCase().replace(/\s+/g, '\\s+');
  if (!compact) return false;
  return new RegExp(`\\b${compact}\\b`, 'i').test(haystack);
}

function applyPriceMultiplier(num: number, mult: string): number {
  const m = mult.toLowerCase();
  if (m === 'bn' || m === 'billion' || m === 'b') return num * 1_000_000_000;
  if (m === 'm' || m === 'million') return num * 1_000_000;
  if (m === 'k' || m === 'thousand') return num * 1_000;
  return num;
}

const PRICE_MULT_SUFFIX = '(m|million|k|thousand|bn|billion|b)';

function parseAmountToken(numStr: string, mult?: string): number {
  const num = parseFloat(numStr.replace(/,/g, ''));
  if (!Number.isFinite(num) || num <= 0) return 0;
  return mult ? applyPriceMultiplier(num, mult) : num;
}

/** Remove agency/legal/caution % fees and service-charge lines so they are not mistaken for rent/price. */
function stripSecondaryChargeClauses(text: string): string {
  let t = text;
  t = t.replace(
    /\b(?:agency|legal|caution|commission|professional|facilitator(?:'s)?|agreement)\s*(?:fee|fees)?\s*[:\s]*\d+(?:\.\d+)?\s*(?:%|\*)/gi,
    ' '
  );
  t = t.replace(/\b\d+(?:\.\d+)?\s*(?:%|\*)\s*(?:agency|legal|caution|commission|fee|fees)\b/gi, ' ');
  t = t.replace(
    new RegExp(
      `\\b(?:sc|s\\/c|service\\s*charge)\\s*[;:#\\-–—]?\\s*(?:₦|NGN|N)?\\s*[\\d.,]+\\s*${PRICE_MULT_SUFFIX}?\\b`,
      'gi'
    ),
    ' '
  );
  return t;
}

type PriceHit = { value: number; priority: number; pos: number };

function isPercentLiteral(text: string, matchIndex: number, matchLen: number): boolean {
  const tail = text.slice(matchIndex + matchLen).trimStart();
  return tail.startsWith('%') || tail.startsWith('*');
}

/** True when the matched amount is an area/size (e.g. "1781 Sqm"), not a price. */
function isAreaUnitAfter(text: string, matchIndex: number, matchLen: number): boolean {
  const tail = text.slice(matchIndex + matchLen).trimStart();
  return /^(?:sq\.?\s*m(?:eters?)?|sqm|m\s*2|m²|acres?|hectares?|ha|plots?)\b/i.test(tail);
}

/**
 * True when a trailing "m" multiplier is actually square meters
 * (e.g. "1,123.100m²" / "500m2"), not millions.
 */
function isSquareMeterMultiplier(text: string, matchIndex: number, matchLen: number, multRaw: string): boolean {
  if (multRaw !== 'm') return false;
  const after = text.slice(matchIndex + matchLen);
  return /^[²2]/.test(after) || /^\s*[²2]\b/.test(after);
}

function collectPriceHits(text: string): PriceHit[] {
  const hits: PriceHit[] = [];
  // "m" must not swallow m² / m2 (plot size written as 1,123.100m²).
  const multPart = '(?:m(?![²2])|million|k|thousand|bn|billion|b(?![a-z]))';
  const multCapture = '(m(?![²2])|million|k|thousand|bn|billion|b(?![a-z]))';
  // "#" is a common WhatsApp stand-in for ₦.
  const labeledAmount = `(?:(?:₦|NGN|N|#)\\s*)?([\\d.,]+)\\s*(${multCapture})?`;
  const specs: Array<{ re: RegExp; priority: number; requireMult?: boolean }> = [
    {
      re: new RegExp(
        `\\bfor\\s*(?:sale|rent)\\s*(?:[;:#\\-–—]\\s*)?${labeledAmount}`,
        'gi'
      ),
      priority: 110,
    },
    {
      re: new RegExp(`\\b(?:rent|asking|lease)\\s*[;:#\\-–—]\\s*${labeledAmount}`, 'gi'),
      priority: 100,
    },
    {
      re: new RegExp(
        `\\b(?:price|sale\\s*price|asking\\s*price|amount)\\s*[;:#\\-–—]\\s*${labeledAmount}`,
        'gi'
      ),
      priority: 90,
    },
    { re: new RegExp(`\\b([\\d.,]+)\\s*(${multCapture})\\s*net\\b`, 'gi'), priority: 88, requireMult: true },
    { re: /(?:₦|NGN|#)\s*([\d.,]+)\s*(m(?![²2])|million|k|thousand|bn|billion|b(?![a-z]))?/gi, priority: 80 },
    { re: /(?:^|[\s,(])N\s*([\d.,]+)\s*(m(?![²2])|million|k|thousand|bn|billion|b(?![a-z]))?/gi, priority: 75 },
    { re: new RegExp(`\\b([\\d.,]+)\\s*(${multPart})\\b`, 'gi'), priority: 70, requireMult: true },
  ];

  for (const { re, priority, requireMult } of specs) {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
      const multRaw = (m[2] || '').toLowerCase();
      if (requireMult && !multRaw) continue;
      if (isPercentLiteral(text, m.index, m[0].length)) continue;
      if (isAreaUnitAfter(text, m.index, m[0].length)) continue;
      if (isSquareMeterMultiplier(text, m.index, m[0].length, multRaw)) continue;
      const value = parseAmountToken(m[1], multRaw || undefined);
      if (value > 0) hits.push({ value, priority, pos: m.index });
    }
  }

  return hits;
}

function pickBestPriceHit(hits: PriceHit[]): number {
  if (!hits.length) return 0;
  hits.sort((a, b) => b.priority - a.priority || b.value - a.value || a.pos - b.pos);
  const bestPriority = hits[0].priority;
  const topGroup = hits.filter((h) => h.priority === bestPriority);
  let value = Math.max(...topGroup.map((h) => h.value));

  // Prefer a multiplied primary amount when a bare fee percent (e.g. 10) slipped through.
  if (value <= 100) {
    const scaled = hits.filter((h) => h.value >= 100_000);
    if (scaled.length) value = Math.max(...scaled.map((h) => h.value));
  }
  // Prefer currency/scaled amounts when a bare "for sale <area>" number won on priority.
  if (value > 0 && value < 500_000) {
    const scaled = hits.filter((h) => h.value >= 500_000);
    if (scaled.length) value = Math.max(...scaled.map((h) => h.value));
  }
  return value;
}

function extractPrice(text: string): { value: number; rentPeriod?: 'day' | 'month' | 'year'; pricePerSqm?: number; rest: string } {
  let rest = text;
  let value = 0;
  let rentPeriod: 'day' | 'month' | 'year' | undefined;
  let pricePerSqm: number | undefined;

  const periodRe = new RegExp(
    '\\b(per\\s*(?:year|annum|month|day)|p\\.?\\s*a\\.?|p\\.?\\s*m\\.?|yearly|monthly|/year|/month|/day)\\b',
    'i'
  );
  const periodMatch = text.match(periodRe);
  if (periodMatch) {
    const p = periodMatch[1].toLowerCase();
    const monthRe = new RegExp('\\b(per\\s*month|p\\.?\\s*m\\.?|monthly|/month)\\b');
    const dayRe = new RegExp('\\b(per\\s*day|/day)\\b');
    if (monthRe.test(p)) rentPeriod = 'month';
    else if (dayRe.test(p)) rentPeriod = 'day';
    else rentPeriod = 'year';
  }

  rest = rest.replace(/\b[\d.,]+\s*(?:acres?|hectares?|hectare|ha)\b/gi, ' ');
  // Strip plot sizes like "1,123.100m²" / "500m2" so "m" is not read as millions.
  rest = rest.replace(/\b[\d.,]+\s*(?:sq\.?\s*m(?:eters?)?|sqm|m\s*[²2]|m²)/gi, ' ');

  const perSqmMatch = rest.match(/(?:price|price:)\s*([\d.,]+)\s*m\s*\/\s*sqm/i) ?? rest.match(/\b([\d.,]+)\s*m\s*\/\s*sqm/i);
  if (perSqmMatch) {
    pricePerSqm = parseFloat(perSqmMatch[1].replace(/,/g, '')) * 1_000_000;
    rest = rest.replace(perSqmMatch[0], ' ');
  }

  const cleaned = stripSecondaryChargeClauses(rest);
  value = pickBestPriceHit(collectPriceHits(cleaned));

  return { value, rentPeriod, pricePerSqm, rest };
}

/** Re-parse price (and rent period) from stored WhatsApp description text. */
export function reparsedPriceFromDescription(description: string): {
  price: number;
  listingType: ParsedListing['listingType'];
  rentPeriod?: ParsedListing['rentPeriod'];
} {
  const { parsed } = parseWhatsAppListingText(description);
  return {
    price: parsed.price,
    listingType: parsed.listingType,
    rentPeriod: parsed.rentPeriod,
  };
}

/** Detect listings where a fee % or bare small number was stored instead of the real rent/price. */
export function isLikelyMispricedWhatsAppListing(input: {
  price: number;
  listingType: string;
  rentPeriod?: string;
  description: string;
}): { mispriced: boolean; reparsedPrice: number; reason?: string } {
  const reparsed = reparsedPriceFromDescription(input.description);
  if (reparsed.price <= 0) return { mispriced: false, reparsedPrice: 0 };

  const current = input.price;
  const next = reparsed.price;
  if (next === current) return { mispriced: false, reparsedPrice: next };

  const desc = input.description;
  const hasFeePercents =
    /\b(?:agency|legal|caution|commission)\b/i.test(desc) &&
    /\b\d+(?:\.\d+)?\s*(?:%|\*)/i.test(desc);
  const hasScaledAmount = /\b\d+(?:\.\d+)?\s*(?:m|million|k|thousand|bn|billion|b)\b/i.test(desc);

  if (current <= 100 && next >= 25_000 && hasScaledAmount) {
    return {
      mispriced: true,
      reparsedPrice: next,
      reason: hasFeePercents ? 'fee percent stored as price' : 'scaled amount in description',
    };
  }
  if (input.listingType === 'rent' && current < 25_000 && next >= 25_000) {
    return { mispriced: true, reparsedPrice: next, reason: 'rent below realistic minimum' };
  }
  if (hasScaledAmount && current < 500_000 && next >= 500_000 && next > current * 10) {
    return { mispriced: true, reparsedPrice: next, reason: 'description mentions m/k/bn amount' };
  }
  // Area mistaken as price (e.g. "For Sale 1781 Sqm … ₦650M" stored as 1781).
  if (hasScaledAmount && current >= 100 && current <= 50_000 && next >= 1_000_000 && next > current * 100) {
    return { mispriced: true, reparsedPrice: next, reason: 'area/size stored as price' };
  }
  // Plot size with m² parsed as millions (e.g. "1,123.100m² … #100m" stored as 1.123B).
  if (hasScaledAmount && next >= 1_000_000 && current > next * 5 && current >= 10_000_000) {
    return { mispriced: true, reparsedPrice: next, reason: 'area m² mistaken for millions' };
  }
  if (next > current * 50 && next >= 100_000) {
    return { mispriced: true, reparsedPrice: next, reason: 'reparsed price much higher' };
  }

  return { mispriced: false, reparsedPrice: next };
}

/** Extract area in square meters (e.g. 500sqm, 1,634sqm, 1,123.100m²). */
function extractArea(text: string): { area: number; rest: string } {
  const m =
    text.match(/\b([\d,.]+)\s*(?:sq\.?\s*m(?:eters?)?|sqm)\b/i) ??
    text.match(/\b([\d,.]+)\s*m\s*[²2]/i) ??
    text.match(/\b([\d,.]+)\s*m²/i);
  if (m) {
    const area = parseFloat(m[1].replace(/,/g, ''));
    return { area: area > 0 ? area : 0, rest: text.replace(m[0], ' ') };
  }
  return { area: 0, rest: text };
}

function extractBedsBaths(text: string): { bedrooms: number; bathrooms: number; toilets?: number; rest: string } {
  let rest = text;
  let bedrooms = 0;
  let bathrooms = 0;
  let toilets: number | undefined;

  const bedMatch = rest.match(/\b(\d+)\s*(?:bed|bedroom|br|beds|bedrooms)\b/i);
  if (bedMatch) {
    bedrooms = parseInt(bedMatch[1], 10);
    rest = rest.replace(bedMatch[0], ' ');
  }
  const bathMatch = rest.match(/\b(\d+)\s*(?:bath|bathroom|baths)\b/i);
  if (bathMatch) {
    bathrooms = parseInt(bathMatch[1], 10);
    rest = rest.replace(bathMatch[0], ' ');
  }
  const toiletMatch = rest.match(/\b(\d+)\s*toilet/i);
  if (toiletMatch) {
    toilets = parseInt(toiletMatch[1], 10);
    rest = rest.replace(toiletMatch[0], ' ');
  }
  return { bedrooms, bathrooms, toilets, rest };
}

function extractListingType(text: string): {
  listingType: (typeof LISTING_TYPE)[keyof typeof LISTING_TYPE];
  rest: string;
} {
  let rest = text;
  let listingType: (typeof LISTING_TYPE)[keyof typeof LISTING_TYPE] = LISTING_TYPE.SALE;
  if (
    /\b(joint\s+venture|\bjv\b|jv\s+in|partnership\s+on\s+land|sharing\s+ratio|facilitator'?s?\s+fee)\b/i.test(
      text
    )
  ) {
    listingType = LISTING_TYPE.JOINT_VENTURE;
    rest = rest.replace(
      /\b(joint\s+venture|\bjv\b|jv\s+in)\b/gi,
      ' '
    );
  } else if (
    /\b(for\s*rent|to\s*rent|to\s*let|rental|renting|available\s*for\s*rent|short\s*let|shortlet)\b/i.test(
      text
    )
  ) {
    listingType = LISTING_TYPE.RENT;
    rest = rest.replace(
      /\b(for\s*rent|to\s*rent|to\s*let|rental|renting|available\s*for\s*rent|short\s*let|shortlet)\b/gi,
      ' '
    );
  } else if (/\b(for\s*sale|to\s*sell|selling|available\s*for\s*sale)\b/i.test(text)) {
    listingType = LISTING_TYPE.SALE;
    rest = rest.replace(/\b(for\s*sale|to\s*sell|selling|available\s*for\s*sale)\b/gi, ' ');
  }
  return { listingType, rest };
}

/**
 * Common asset words that map to a PROPERTY_TYPES slug but are not the slug
 * itself. Matched by earliest position alongside the enum keywords so they
 * only win when named before any other asset (not as an amenity).
 */
const TYPE_SYNONYM_PATTERNS: Array<{ type: string; re: RegExp }> = [
  {
    type: 'restaurant',
    re: /\b(?:eateries|eatery|restaurants?|bakery|bakeries|cafeteria|cafe|caf\u00e9|canteen|fast\s*food|food\s*court|pizzeria|bukka?)\b/i,
  },
  {
    type: 'apartment',
    re: /\b(?:flats?|apartments?)\b/i,
  },
];

/**
 * True when the post is selling/leasing a fuel (filling/petrol/gas) station
 * itself, as opposed to merely referencing one as a nearby landmark
 * (e.g. "land behind NNPC filling station", "duplex, landmark Shafa station").
 *
 * A station mention only counts when it is backed by station attributes
 * (pumps / nozzles / underground tanks / PMS-AGO-DPK / litres capacity /
 * right-to-lift / DPR) or by an explicit "station for sale/lease" headline,
 * and is not phrased as a directional landmark.
 */
function looksLikeFillingStation(lower: string): boolean {
  const stationPhrase = /\b(?:filling|petrol|fuel|fueling|petroleum|gas)\s*[-]?\s*station\b/;
  if (!stationPhrase.test(lower)) return false;

  // Marine vessels (dump/cargo/oil-tank barges) are bundled into some
  // multi-item briefs alongside stations — they are not filling stations.
  if (/\bbarge\b/.test(lower)) return false;

  // Physical fuel-station attributes — a landmark reference never has these.
  const hasAttributes =
    /\b\d+\s*(?:nos\.?|nozzles?|pumps?)\b/.test(lower) ||
    /\b(?:under\s*ground|underground)\s*tanks?\b/.test(lower) ||
    /\bdispensing\s*pumps?\b/.test(lower) ||
    /\b(?:right\s*to\s*lift|lifting\s*right)\b/.test(lower) ||
    /\bdpr\b/.test(lower) ||
    /\b(?:pms|ago|dpk)\b/.test(lower) ||
    /\d[\d,]*\s*(?:litres?|liters?)\b/.test(lower);
  if (hasAttributes) return true;

  // Explicit intent: the station itself is the asset for sale/lease.
  const intent =
    /(?:filling|petrol|fuel|gas)\s*[-]?\s*station\s+(?:is\s+)?(?:now\s+)?for\s+(?:sale|sales|lease|rent)\b/.test(
      lower
    ) ||
    /\bfor\s+(?:sale|sales|lease|rent)\b[\s:!.\-]*(?:a\s+|an\s+|new\s+|brand\s+new\s+)?(?:filling|petrol|fuel|gas)\s*[-]?\s*station\b/.test(
      lower
    );
  return intent;
}

function mentionsBedrooms(lower: string): boolean {
  return /\b\d+\s*[-\s]?(?:bed(?:room)?s?|br)\b/.test(lower);
}

function earliestResidentialTypeInText(lower: string): string | null {
  const match: { best: { type: string; index: number; len: number } | null } = {
    best: null,
  };
  const consider = (type: string, index: number, len: number) => {
    const { best } = match;
    if (best === null || index < best.index || (index === best.index && len > best.len)) {
      match.best = { type, index, len };
    }
  };
  for (const p of RESIDENTIAL_PROPERTY_TYPES) {
    let re: RegExp;
    if (p === 'terrace') {
      re = /\b(?<!roof\s{0,2}top\s)terraces?\b/i;
    } else {
      const pattern = p.replace(/_/g, '[\\s_-]*');
      re = new RegExp(`\\b${pattern}s?\\b`, 'i');
    }
    const m = re.exec(lower);
    if (m) consider(p, m.index, p.length);
  }
  for (const { type, re } of TYPE_SYNONYM_PATTERNS) {
    if (type !== 'apartment') continue;
    const m = re.exec(lower);
    if (m) consider(type, m.index, m[0].length);
  }
  return match.best?.type ?? null;
}

function refinePropertyTypeForBedrooms(type: string, lower: string): string {
  if (type !== 'land') return type;
  const residential = earliestResidentialTypeInText(lower);
  if (residential) return residential;
  if (mentionsBedrooms(lower)) return 'house';
  return type;
}

/**
 * Classify a property post into a PROPERTY_TYPES slug.
 *
 * Strategy (in priority order):
 *  1. Fuel (filling / petrol / gas) stations — checked first because such a
 *     post almost always also mentions ancillary space like "shops" or
 *     "office spaces" that would otherwise win. Landmark-only mentions are
 *     excluded (see looksLikeFillingStation).
 *  2. The property-type keyword that appears EARLIEST in the post. The primary
 *     asset being sold is normally named first, so this avoids classifying a
 *     "Filling Station ... with ... 5 office Spaces" post as an office.
 *     Ties are broken by the longer keyword (e.g. "warehouse" over "house").
 *  3. Land fallbacks (plot / bare land / sqm-only).
 *  4. Default to apartment.
 */
export function extractPropertyType(text: string): string {
  const lower = text.toLowerCase();

  // 1) Filling / petrol / gas / fuel station (only when it is the asset).
  if (looksLikeFillingStation(lower)) {
    return 'filling_station';
  }

  // 1b) Petroleum tank farm / fuel depot — industrial storage infrastructure,
  //     not an agricultural "farm" (which the keyword loop would pick up).
  if (/\btank\s*farm\b/.test(lower) || /\b(?:fuel|petroleum|oil)\s*depot\b/.test(lower)) {
    return 'industrial';
  }

  // 2) Earliest-mentioned property type wins; longer keyword breaks ties.
  //    Some types have common synonyms that are not the enum slug itself
  //    (e.g. an "eatery"/"bakery" is a restaurant). These compete by position
  //    too, so a hotel that merely mentions a restaurant amenity stays a hotel
  //    (hotel is named first), while an eatery post becomes a restaurant.
  const match: { best: { type: string; index: number; len: number } | null } = {
    best: null,
  };
  const consider = (type: string, index: number, len: number) => {
    const { best } = match;
    if (
      best === null ||
      index < best.index ||
      (index === best.index && len > best.len)
    ) {
      match.best = { type, index, len };
    }
  };
  for (const p of PROPERTY_TYPES) {
    // filling_station is decided only by its guarded pre-check above; matching
    // it here as a bare keyword would bypass the landmark/barge/attribute rules.
    if (p === 'filling_station') continue;
    let re: RegExp;
    if (p === 'terrace') {
      // A "terrace duplex" (duplexes built side by side) is genuinely a terrace,
      // and earliest-mention already keeps it as one. But a "roof top terrace"
      // is an amenity, not the asset type — so don't let it register as terrace
      // (otherwise a fully detached duplex "with rooftop terrace" reads as terrace).
      re = /\b(?<!roof\s{0,2}top\s)terraces?\b/i;
    } else {
      const pattern = p.replace(/_/g, '[\\s_-]*');
      re = new RegExp(`\\b${pattern}s?\\b`, 'i');
    }
    const m = re.exec(lower);
    if (m) consider(p, m.index, p.length);
  }
  for (const { type, re } of TYPE_SYNONYM_PATTERNS) {
    const m = re.exec(lower);
    if (m) consider(type, m.index, m[0].length);
  }
  if (match.best) return refinePropertyTypeForBedrooms(match.best.type, lower);

  // 3) Land fallbacks.
  if (!mentionsBedrooms(lower)) {
    if (/\b(plot|front plot|partitioned|bare\s*land|water\s*front)\b/.test(lower)) return 'land';
    if (
      /\b\d[\d,]*\s*sqm\b/.test(lower) &&
      !/\b(apartment|bungalow|house|duplex|villa|studio|penthouse|terrace|commercial|warehouse|hotel|maisonette|bungalow)\b/.test(
        lower
      )
    ) {
      return 'land';
    }
  }
  if (mentionsBedrooms(lower)) return refinePropertyTypeForBedrooms('land', lower);
  return 'apartment';
}

function extractPhone(text: string): { phone: string | undefined; rest: string } {
  // Sender at start (e.g. "[6:02 AM, 3/3/2026] +234 806 121 7377: message" or "+234 806 121 7377: message")
  const leadingPhone = text.match(/^(?:\[[^\]]*\]\s*)?(\+\s*234\s*\d{3}\s*\d{3}\s*\d{4}|234\s*\d{3}\s*\d{3}\s*\d{4}|0\d{10})\s*:/i);
  if (leadingPhone) {
    let phone = leadingPhone[1].replace(/\s/g, '');
    if (phone.startsWith('0')) phone = '+234' + phone.slice(1);
    else if (!phone.startsWith('+')) phone = '+' + phone;
    return { phone, rest: text.replace(leadingPhone[0], ' ').trim() };
  }
  const re = /(?:\b|call|contact|whatsapp|whatsapp:)\s*([0]?\d{10,11}|\+\s*234\s*\d{3}\s*\d{3}\s*\d{4})\b/gi;
  const m = re.exec(text);
  if (m) {
    let phone = m[1].replace(/\s/g, '');
    if (phone.startsWith('0')) phone = '+234' + phone.slice(1);
    else if (!phone.startsWith('+')) phone = '+234' + phone;
    return { phone, rest: text.replace(m[0], ' ') };
  }
  return { phone: undefined, rest: text };
}

function inferStateWhenUnknown(lower: string): string {
  if (/\b(lagos|lekki|ikeja|ajah|yaba|surulere|ikorodu|alimosho|vi\b|victoria island|ikoyi|oshodi|agege)\b/i.test(lower)) {
    return 'Lagos';
  }
  if (
    /\b(abuja|fct|kubwa|maitama|gwarinpa|wuse|jahi|jabi|jayi|lugbe|nyanya|karu|asokoro|guzape|katampe|lokogoma|dutse|kaura|kuje|bwari|gwagwalada|utako|garki)\b/i.test(
      lower
    )
  ) {
    return 'FCT';
  }
  if (/\b(port\s*har(?:c)?ourt|pitakwa|trans\s*amadi|oyigbo|eleme|ph\b)\b/i.test(lower)) {
    return 'Rivers';
  }
  if (/\b(ibadan|bodija|mokola|dugbe|oluyole|ogbomosho)\b/i.test(lower)) {
    return 'Oyo';
  }
  return 'Lagos';
}

function extractLocation(text: string): { state: string; city: string; address: string; suburb?: string; rest: string } {
  let state = '';
  let city = '';
  let address = '';
  let suburb: string | undefined;
  let rest = text;

  const lower = text.toLowerCase();
  const locationMatch = text.match(/(?:location|address)\s*:\s*([^\n.]+)/i);
  if (locationMatch) {
    const locationLine = locationMatch[1].trim();
    if (locationLine.length >= 5) {
      address = locationLine;
      rest = rest.replace(locationMatch[0], ' ');
    }
  }
  if (!address) {
    const situatedMatch = text.match(/\b(?:situated|located)\s+at\s+([^\n.]{5,200})/i);
    if (situatedMatch) {
      address = situatedMatch[1].trim();
    }
  }

  for (const [alias, s] of Object.entries(STATE_ALIASES)) {
    if (includesPhrase(lower, escapeRegex(alias.toLowerCase()))) {
      state = s;
      break;
    }
  }
  if (!state) {
    const detected = detectNigerianStateInText(lower);
    if (detected) state = detected;
  }

  const gazette = resolveNigeriaPlaceFromText(text, { preferredState: state || undefined });
  if (gazette) {
    state = gazette.state;
    city = gazette.city;
    if (gazette.suburb) suburb = gazette.suburb;
  } else {
    for (const [area, loc] of Object.entries(COMMON_AREAS)) {
      if (includesPhrase(lower, escapeRegex(area.toLowerCase()))) {
        city = loc.city;
        if (!state) state = loc.state;
        suburb = loc.city;
        break;
      }
    }
  }

  if (!city && state) city = state;

  const validState = NIGERIAN_STATES.includes(state as (typeof NIGERIAN_STATES)[number])
    ? state
    : inferStateWhenUnknown(lower);
  if (!city) city = validState === 'FCT' ? 'Abuja' : validState;
  if (!address) {
    const addrParts = [suburb, city, validState]
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p) => p.length > 0);
    const dedup = Array.from(new Map(addrParts.map((p) => [p.toLowerCase(), p])).values());
    address = dedup.join(', ');
  }
  if (address.length < 5) {
    const cityState =
      city.toLowerCase() !== validState.toLowerCase() ? `${city}, ${validState}` : `${validState}, Nigeria`;
    if (cityState.length >= 5) address = cityState;
  }
  return { state: validState, city, address, suburb, rest };
}

/**
 * Parse raw WhatsApp-style property text into a listing payload.
 * Fills defaults for missing fields; description is the original text.
 */
export function parseWhatsAppListingText(raw: string): ParseResult {
  const stripped = stripChatArtifacts(raw);
  const text = normalizeText(stripped);
  const missing: string[] = [];

  const { value: priceVal, rentPeriod, pricePerSqm } = extractPrice(text);
  const { listingType } = extractListingType(text);
  const { area } = extractArea(text);
  const { bedrooms, bathrooms, toilets } = extractBedsBaths(text);
  const { phone: agentPhone } = extractPhone(text);
  const { state, city, address, suburb } = extractLocation(text);
  const propertyType = extractPropertyType(text);

  const price =
    priceVal > 0
      ? priceVal
      : pricePerSqm && area
        ? Math.round(pricePerSqm * area)
        : pricePerSqm ?? 0;

  const desc = prepareWhatsAppListingDescription(raw);
  const title = buildCanonicalListingTitle({
    listingType,
    propertyType,
    propertyTypes: [propertyType],
    address,
    city,
    state,
    suburb,
    bedrooms: bedrooms || 0,
    area,
    description: desc,
  }).slice(0, 200);

  if (!price) missing.push('price');
  if (!state) missing.push('state');
  if (!city) missing.push('city');
  if (!agentPhone) missing.push('agentPhone');

  const confidence: ParseResult['confidence'] =
    missing.length === 0 ? 'high' : missing.length <= 2 ? 'medium' : 'low';

  const parsed: ParsedListing = {
    title,
    description: desc.slice(0, 5000) || 'Imported from WhatsApp. Please add description.',
    listingType,
    propertyType,
    price,
    location: { address: address || city || state, city, state },
    bedrooms: bedrooms || 0,
    bathrooms: bathrooms || 0,
    toilets,
    agentPhone,
    rentPeriod: listingType === 'rent' ? (rentPeriod || 'year') : undefined,
    amenities: [],
    tags: ['whatsapp-import'],
  };
  if (suburb) parsed.location.suburb = suburb;
  if (area) parsed.area = area;

  return { parsed, confidence, missing };
}

/** Splits raw text into segments that may each be one listing (double newlines, numbered items, or dividers). */
function splitIntoListingBlocks(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // Split by double newline or more
  let segments = normalized.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);

  // If we got a single long segment, try splitting by numbered list: "(1)" "(2)" or "1." "2." or "1)" "2)"
  if (segments.length <= 1 && normalized.length > 200) {
    const byNumbered = normalized.split(/\n\s*(?=\(\d+\)\s|\d+[.)]\s|[-•]\s*(?=.*\d\s*(?:m|k|million|bn|sqm)\b|.*for\s*(?:rent|sale)))/i);
    if (byNumbered.length > 1) {
      segments = byNumbered
        .map((s) => s.replace(/^\(\d+\)\s*|^\d+[.)]\s*|\n\s*[-•]\s*/gi, '').trim())
        .filter((s) => s.length >= 20);
    }
  }

  // Also split by common dividers (---, ___, ***)
  const result: string[] = [];
  for (const seg of segments) {
    const parts = seg.split(/\n\s*[-*_]{2,}\s*\n/).map((s) => s.trim()).filter(Boolean);
    result.push(...(parts.length > 1 ? parts : [seg]));
  }

  return result.filter((s) => s.length >= 15);
}

/**
 * Detect multiple listings in a single post and parse each.
 * Uses block splits (double newline, numbered list, dividers) then runs single-listing parser on each block.
 */
/** Extract leading sender phone from full message (e.g. "[date] +234 806 121 7377: message"). */
function extractLeadingSenderPhone(raw: string): string | undefined {
  const m = raw.match(/^(?:\[[^\]]*\]\s*)?(\+\s*234\s*\d{3}\s*\d{3}\s*\d{4}|234\s*\d{3}\s*\d{3}\s*\d{4}|0\d{10})\s*:/i);
  if (!m) return undefined;
  let phone = m[1].replace(/\s/g, '');
  if (phone.startsWith('0')) phone = '+234' + phone.slice(1);
  else if (!phone.startsWith('+')) phone = '+' + phone;
  return phone;
}

export function parseMultipleWhatsAppListings(raw: string): ParseResult[] {
  const leadingPhone = extractLeadingSenderPhone(raw);
  const blocks = splitIntoListingBlocks(raw);
  if (blocks.length === 0) {
    const single = parseWhatsAppListingText(raw);
    if (single.parsed.price > 0 || single.parsed.bedrooms > 0 || single.parsed.area) {
      if (!single.parsed.agentPhone && leadingPhone) single.parsed.agentPhone = leadingPhone;
      return [single];
    }
    return [];
  }
  const results: ParseResult[] = [];
  for (const block of blocks) {
    const result = parseWhatsAppListingText(block);
    if (!result.parsed.agentPhone && leadingPhone) result.parsed.agentPhone = leadingPhone;
    const looksLikeListing =
      result.parsed.price > 0 ||
      result.parsed.bedrooms > 0 ||
      (result.parsed.area ?? 0) > 0 ||
      (block.length >= 40 && (/\b(rent|sale|bed|bath|₦|m\b|k\b|sqm|bn\b)/i.test(block)));
    if (looksLikeListing) results.push(result);
  }
  return results.length > 0 ? results : [parseWhatsAppListingText(raw)];
}
