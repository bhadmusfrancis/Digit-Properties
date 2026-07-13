import {
  WHATSAPP_CHAT_IMPORT_TAG,
  WHATSAPP_IMPORT_TAG,
} from '@/lib/listing-seo-prep';
import { prepareWhatsAppListingDescription } from '@/lib/whatsapp-listing-parser';

export { prepareWhatsAppListingDescription };

export function isWhatsAppImportListing(tags: string[] | null | undefined): boolean {
  if (!Array.isArray(tags)) return false;
  return tags.some(
    (t) => t === WHATSAPP_IMPORT_TAG || t === WHATSAPP_CHAT_IMPORT_TAG
  );
}

const HUMANIZED_HTML_MARKERS = [
  /listed for (?:rent|sale) on digit properties/i,
  /we recommend a physical inspection/i,
  /digit properties connects you/i,
  /may suit buyers or tenants/i,
  /summarised the listing in plain language/i,
  /features noted in this listing/i,
  /price is available on request/i,
  /the asking price is/i,
];

/** True when description looks like the batch human-tone HTML rewrite. */
export function looksLikeHumanizedListingHtml(description: string | null | undefined): boolean {
  const raw = (description ?? '').trim();
  if (!raw || !/<[a-z][\s\S]*>/i.test(raw)) return false;
  return HUMANIZED_HTML_MARKERS.some((re) => re.test(raw));
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

/**
 * Convert humanized HTML descriptions back to WhatsApp-style plain text
 * (*bold*, newlines) so listing detail pages keep the WhatsApp renderer.
 */
export function htmlDescriptionToWhatsAppPlainText(html: string): string {
  let t = html.replace(/\r\n/g, '\n');

  t = t.replace(/<\/(p|div|h[1-6]|tr)>/gi, '\n\n');
  t = t.replace(/<(p|div|h[1-6])(?:\s[^>]*)?>/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/li>/gi, '\n');
  t = t.replace(/<li(?:\s[^>]*)?>/gi, '• ');
  t = t.replace(/<\/?(?:ul|ol)(?:\s[^>]*)?>/gi, '\n');

  t = t.replace(/<(strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (_, _tag, inner: string) => {
    const plain = decodeBasicEntities(inner.replace(/<[^>]*>/g, '')).trim();
    return plain ? `*${plain}*` : '';
  });
  t = t.replace(/<(em|i)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (_, _tag, inner: string) => {
    const plain = decodeBasicEntities(inner.replace(/<[^>]*>/g, '')).trim();
    return plain ? `_${plain}_` : '';
  });

  t = t.replace(/<[^>]*>/g, '');
  t = decodeBasicEntities(t);
  t = t.replace(/[ \t]+\n/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/[ \t]{2,}/g, ' ');
  return t.trim();
}

/**
 * Ensure WhatsApp-import descriptions use plain WhatsApp markup, not escaped HTML.
 * No-op when the description is already plain text.
 */
export function ensureWhatsAppStyleDescription(description: string | null | undefined): string {
  const raw = (description ?? '').trim();
  if (!raw) return '';
  if (!looksLikeHumanizedListingHtml(raw) && !/<[a-z][\s\S]*>/i.test(raw)) {
    return prepareWhatsAppListingDescription(raw);
  }
  const plain = htmlDescriptionToWhatsAppPlainText(raw);
  return prepareWhatsAppListingDescription(plain);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render WhatsApp *bold*, _italic_, and ~strikethrough~ markup for listing detail pages. */
export function formatWhatsAppMarkupToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    .replace(/\n/g, '<br />\n');
}
