/**
 * POST /api/listings/parse-from-text
 * Parse WhatsApp-style property text into a listing payload for "Import from WhatsApp".
 * Does not create a listing; returns parsed data for the form to pre-fill.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { parseWhatsAppListingText } from '@/lib/whatsapp-listing-parser';
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

    const result = parseWhatsAppListingText(text);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[parse-from-text]', e);
    return NextResponse.json({ error: 'Failed to parse text' }, { status: 500 });
  }
}
