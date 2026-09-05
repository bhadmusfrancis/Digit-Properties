import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import ListingConversation from '@/models/ListingConversation';
import { requireVerifiedSession } from '@/lib/require-verified-session';
import {
  MESSAGE_LISTING_FIELDS,
  MESSAGE_USER_FIELDS,
  conversationRole,
  shapeListingSummary,
  shapeMessagePerson,
  unreadForUser,
} from '@/lib/listing-messages';

export async function GET(req: Request) {
  try {
    const auth = await requireVerifiedSession(req);
    if (!auth.ok) return auth.response;

    await dbConnect();
    const conversations = await ListingConversation.find({
      $or: [{ buyerId: auth.userId }, { listingOwnerId: auth.userId }],
    })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .populate('listingId', MESSAGE_LISTING_FIELDS)
      .populate('buyerId', MESSAGE_USER_FIELDS)
      .populate('listingOwnerId', MESSAGE_USER_FIELDS)
      .lean();

    return NextResponse.json({
      conversations: conversations.map((c) => {
        const role = conversationRole(c, auth.userId) ?? 'buyer';
        const other = role === 'owner' ? c.buyerId : c.listingOwnerId;
        return {
          _id: String(c._id),
          yourRole: role,
          listing: shapeListingSummary(
            c.listingId as { _id?: unknown; title?: string; slug?: string | null }
          ),
          otherParty: shapeMessagePerson(
            other as { _id?: unknown; firstName?: string; name?: string; image?: string }
          ),
          lastMessagePreview: c.lastMessagePreview,
          lastMessageAt: c.lastMessageAt,
          unreadCount: unreadForUser(c, auth.userId),
        };
      }),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}
