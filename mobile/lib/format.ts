import { formatListingTypeLabel, formatPropertyTypeLabel } from './constants';

export function formatPrice(n: number, rentPeriod?: string | null) {
  const formatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
  if (!rentPeriod) return formatted;
  const suffix = rentPeriod === 'day' ? '/day' : rentPeriod === 'month' ? '/mo' : '/yr';
  return `${formatted}${suffix}`;
}

export function formatLocation(loc?: {
  suburb?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
} | null): string {
  if (!loc) return '';
  const parts = [loc.suburb, loc.city, loc.state]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
  const unique = Array.from(new Map(parts.map((p) => [p.toLowerCase(), p])).values());
  if (unique.length) return unique.join(', ');
  return typeof loc.address === 'string' ? loc.address.trim() : '';
}

export function formatBedsBaths(listing: {
  bedrooms?: number | null;
  bathrooms?: number | null;
  area?: number | null;
  propertyType?: string | null;
}): string {
  const bits: string[] = [];
  if (listing.bedrooms && listing.bedrooms > 0) bits.push(`${listing.bedrooms} bd`);
  if (listing.bathrooms && listing.bathrooms > 0) bits.push(`${listing.bathrooms} ba`);
  if (listing.area && listing.area > 0) bits.push(`${listing.area} sqm`);
  if (!bits.length && listing.propertyType) return formatPropertyTypeLabel(listing.propertyType);
  return bits.join(' · ');
}

export function listingTypeBadge(listingType?: string | null): string {
  if (listingType === 'rent') return 'For rent';
  if (listingType === 'joint_venture') return 'Joint venture';
  if (listingType === 'sale') return 'For sale';
  return formatListingTypeLabel(listingType || 'sale');
}

export function stripHtml(html?: string | null): string {
  if (!html) return '';
  if (!/<[a-z][\s\S]*>/i.test(html)) return html.trim();
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function toTelHref(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (!clean) return '';
  const num = clean.startsWith('234') ? clean : `234${clean.replace(/^0/, '')}`;
  return `tel:+${num}`;
}

export function toWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '');
  if (!clean) return '';
  const num = clean.startsWith('234') ? clean : `234${clean.replace(/^0/, '')}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

export function greetingForNow(name?: string | null): string {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${hello}, ${first}` : hello;
}
