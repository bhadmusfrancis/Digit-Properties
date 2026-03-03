/**
 * POST /api/listings/parse-from-text
 * Parse WhatsApp-style property text into listing payload(s) for "Import from WhatsApp".
 * Supports single or multiple listings in one post; optional sender details and media URLs (e.g. from webhook).
 * Does not create listings; returns parsed data for the form to pre-fill.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  parseWhatsAppListingText,
  parseMultipleWhatsAppListings,
  type SenderDetails,
} from '@/lib/whatsapp-listing-parser';
import { USER_ROLES } from '@/lib/constants';

const CAN_CREATE = [USER_ROLES.ADMIN, USER_ROLES.REGISTERED_AGENT, USER_ROLES.REGISTERED_DEVELOPER, USER_ROLES.VERIFIED_INDIVIDUAL];

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || !(CAN_CREATE as readonly string[]).includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text || text.length < 10) {
      return NextResponse.json(
        { error: 'Please provide a "text" string (at least 10 characters) from the WhatsApp message.' },
        { status: 400 }
      );
    }

    const multiple = Boolean(body?.multiple);
    const senderDetails =
      body?.senderDetails && typeof body.senderDetails === 'object'
        ? (body.senderDetails as SenderDetails)
        : undefined;
    const mediaUrls = Array.isArray(body?.mediaUrls)
      ? body.mediaUrls.filter((u: unknown) => typeof u === 'string')
      : undefined;

    if (multiple) {
      const listings = parseMultipleWhatsAppListings(text);
      return NextResponse.json({
        listings,
        senderDetails: senderDetails ?? undefined,
        mediaUrls,
      });
    }

    const result = parseWhatsAppListingText(text);
    return NextResponse.json({
      ...result,
      ...(senderDetails && { senderDetails }),
      ...(mediaUrls && { mediaUrls }),
    });
  } catch (e) {
    console.error('[parse-from-text]', e);
    return NextResponse.json({ error: 'Failed to parse text' }, { status: 500 });
  }
}
