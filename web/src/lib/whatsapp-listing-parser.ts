/**
 * Parse unstructured property text (e.g. from WhatsApp group/status) into
 * Digit Properties listing payload. Used by "Import from WhatsApp" flow.
 */
import { NIGERIAN_STATES, PROPERTY_TYPES } from './constants';

export type ParsedListing = {
  title: string;
  description: string;
  listingType: 'sale' | 'rent';
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
  'ikoyi': { city: 'Ikoyi', state: 'Lagos' },
  'yaba': { city: 'Yaba', state: 'Lagos' },
  'surulere': { city: 'Surulere', state: 'Lagos' },
  'gbagada': { city: 'Gbagada', state: 'Lagos' },
  'maryland': { city: 'Maryland', state: 'Lagos' },
  'ilupeju': { city: 'Ilupeju', state: 'Lagos' },
  'island': { city: 'Lagos Island', state: 'Lagos' },
  'abuja': { city: 'Abuja', state: 'FCT' },
  'maitama': { city: 'Maitama', state: 'FCT' },
  'garki': { city: 'Garki', state: 'FCT' },
  'wuse': { city: 'Wuse', state: 'FCT' },
  'asokoro': { city: 'Asokoro', state: 'FCT' },
  'port harcourt': { city: 'Port Harcourt', state: 'Rivers' },
  'ph city': { city: 'Port Harcourt', state: 'Rivers' },
  'chevron': { city: 'Lekki', state: 'Lagos' },
  'jakande': { city: 'Lekki', state: 'Lagos' },
  'osbourne phase 2': { city: 'Ikoyi', state: 'Lagos' },
  'osbourne': { city: 'Ikoyi', state: 'Lagos' },
  'old ikoyi': { city: 'Ikoyi', state: 'Lagos' },
  'isheri-oshun': { city: 'Isheri-Oshun', state: 'Lagos' },
  'isheri oshun': { city: 'Isheri-Oshun', state: 'Lagos' },
  'isheri': { city: 'Isheri-Oshun', state: 'Lagos' },
};

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim();
}

function extractPrice(text: string): { value: number; rentPeriod?: 'day' | 'month' | 'year'; pricePerSqm?: number; rest: string } {
  let rest = text;
  let value = 0;
  let rentPeriod: 'day' | 'month' | 'year' | undefined;
  let pricePerSqm: number | undefined;

  // per year / per month / per annum / p.a. / p.m. / yearly / monthly (use RegExp to avoid / in literal)
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

  // Price per sqm (e.g. 4m/sqm, 3.5m/sqm) - capture for later * area
  const perSqmMatch = rest.match(/(?:price|price:)\s*([\d.,]+)\s*m\s*\/\s*sqm/i) ?? rest.match(/\b([\d.,]+)\s*m\s*\/\s*sqm/i);
  if (perSqmMatch) {
    pricePerSqm = parseFloat(perSqmMatch[1].replace(/,/g, '')) * 1_000_000;
    rest = rest.replace(perSqmMatch[0], ' ');
  }

  // ₦5m, 5m, 5 million, 500k, 2.7bn, 3.5bn
  const patterns = [
    /(?:₦|N|NGN)\s*([\d.,]+)\s*(m|million|k|thousand|bn|billion)?/i,
    /(?:price|#|amount)\s*[:\s]*([\d.,]+)\s*(m|million|k|thousand|bn|billion)?/i,
    /([\d.,]+)\s*(m|million|k|thousand|bn|billion)\b/i,
    /(?:₦|N|NGN)\s*([\d.,]+)/i,
  ];
  for (const re of patterns) {
    const m = rest.match(re);
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      const mult = (m[2] || '').toLowerCase();
      if (mult === 'bn' || mult === 'billion') value = num * 1_000_000_000;
      else if (mult === 'm' || mult === 'million') value = num * 1_000_000;
      else if (mult === 'k' || mult === 'thousand') value = num * 1_000;
      else value = num;
      if (value > 0) {
        rest = rest.replace(m[0], ' ');
        break;
      }
    }
  }
  return { value, rentPeriod, pricePerSqm, rest };
}

/** Extract area in square meters (e.g. 500sqm, 1,634sqm, 2,400sqm). */
function extractArea(text: string): { area: number; rest: string } {
  const m = text.match(/\b([\d,]+)\s*sqm\b/i);
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

function extractListingType(text: string): { listingType: 'sale' | 'rent'; rest: string } {
  let rest = text;
  let listingType: 'sale' | 'rent' = 'sale';
  if (/\b(for\s*rent|to\s*rent|rental|renting|available\s*for\s*rent)\b/i.test(text)) {
    listingType = 'rent';
    rest = rest.replace(/\b(for\s*rent|to\s*rent|rental|renting|available\s*for\s*rent)\b/gi, ' ');
  } else if (/\b(for\s*sale|to\s*sell|selling|available\s*for\s*sale)\b/i.test(text)) {
    listingType = 'sale';
    rest = rest.replace(/\b(for\s*sale|to\s*sell|selling|available\s*for\s*sale)\b/gi, ' ');
  }
  return { listingType, rest };
}

function extractPropertyType(text: string): string {
  const lower = text.toLowerCase();
  const buildingTypes = ['bungalow', 'duplex', 'penthouse', 'villa', 'terrace', 'commercial', 'studio', 'house', 'apartment'];
  for (const p of buildingTypes) {
    if (new RegExp('\\b' + p + 's?\\b').test(lower)) return p;
  }
  if (/\b(plot|front plot|partitioned)\b/.test(lower)) return 'land';
  if (/\b\d[\d,]*\s*sqm\b/.test(lower) && !/\b(apartment|bungalow|house|duplex|villa|studio|penthouse|terrace|commercial)\b/.test(lower)) return 'land';
  const allowed = [...PROPERTY_TYPES];
  for (const p of allowed) {
    if (new RegExp(`\\b${p}s?\\b`).test(lower)) return p;
  }
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

  for (const [alias, s] of Object.entries(STATE_ALIASES)) {
    if (lower.includes(alias)) {
      state = s;
      break;
    }
  }
  if (!state) {
    for (const s of NIGERIAN_STATES) {
      if (new RegExp('\\b' + s.replace(/\s/g, '\\s*').toLowerCase() + '\\b').test(lower)) {
        state = s;
        break;
      }
    }
  }
  for (const [area, loc] of Object.entries(COMMON_AREAS)) {
    if (lower.includes(area)) {
      city = loc.city;
      if (!state) state = loc.state;
      suburb = loc.city;
      break;
    }
  }
  if (!city && state) city = state;
  if (!state) state = 'Lagos';
  if (!city) city = state;
  const validState = NIGERIAN_STATES.includes(state as (typeof NIGERIAN_STATES)[number]) ? state : 'Lagos';
  if (!address) address = [suburb || city, validState].filter(Boolean).join(', ');
  return { state: validState, city, address, suburb, rest };
}

/**
 * Parse raw WhatsApp-style property text into a listing payload.
 * Fills defaults for missing fields; description is the original text.
 */
export function parseWhatsAppListingText(raw: string): ParseResult {
  const text = normalizeText(raw);
  const missing: string[] = [];

  const { value: priceVal, rentPeriod, pricePerSqm, rest: r1 } = extractPrice(text);
  const { listingType, rest: r2 } = extractListingType(text);
  const { area, rest: rArea } = extractArea(text);
  const { bedrooms, bathrooms, toilets, rest: r3 } = extractBedsBaths(text);
  const { phone: agentPhone, rest: r4 } = extractPhone(text);
  const { state, city, address, suburb } = extractLocation(text);
  const propertyType = extractPropertyType(text);

  const price =
    priceVal > 0
      ? priceVal
      : pricePerSqm && area
        ? Math.round(pricePerSqm * area)
        : pricePerSqm ?? 0;

  const desc = text.length > 100 ? text : text;
  const titleParts: string[] = [];
  if (area) titleParts.push(`${area} sqm`);
  if (bedrooms) titleParts.push(`${bedrooms} Bed`);
  titleParts.push(propertyType.charAt(0).toUpperCase() + propertyType.slice(1));
  if (address) titleParts.push('at ' + (suburb || city || state));
  const title = titleParts.length >= 2 ? titleParts.join(' ') : (text.slice(0, 80) || 'Imported listing');

  if (!price) missing.push('price');
  if (!state) missing.push('state');
  if (!city) missing.push('city');
  if (!agentPhone) missing.push('agentPhone');

  const confidence: ParseResult['confidence'] =
    missing.length === 0 ? 'high' : missing.length <= 2 ? 'medium' : 'low';

  const parsed: ParsedListing = {
    title: title.slice(0, 200),
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
