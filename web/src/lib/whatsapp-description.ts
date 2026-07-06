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
