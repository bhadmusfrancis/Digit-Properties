import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import ListingConversation from '@/models/ListingConversation';
import ListingMessage from '@/models/ListingMessage';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { requireVerifiedSession } from '@/lib/require-verified-session';
import { sendListingMessageEmail } from '@/lib/email';
import {
  MESSAGE_LISTING_FIELDS,
  MESSAGE_USER_FIELDS,
  appendListingMessage,
  conversationRole,
  countRecentSenderMessages,
  isConversationParticipant,
  LISTING_MESSAGE_RATE_LIMIT,
  markConversationRead,
  messagePreview,
  resolveListingOwnerId,
  sanitizeMessageBody,
  shapeListingSummary,
  shapeMessage,
  shapeMessagePerson,
} from '@/lib/listing-messages';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await requireVerifiedSession(req);
    if (!auth.ok) return auth.response;

    const { conversationId } = await params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 });
    }

    await dbConnect();
    const conversation = await ListingConversation.findById(conversationId)
      .populate('listingId', MESSAGE_LISTING_FIELDS)
      .populate('buyerId', MESSAGE_USER_FIELDS)
      .populate('listingOwnerId', MESSAGE_USER_FIELDS)
      .lean();
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.session.user.role !== 'admin' && !isConversationParticipant(conversation, auth.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await markConversationRead(conversationId, auth.userId);
    const messages = await ListingMessage.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('senderId', MESSAGE_USER_FIELDS)
      .lean();

    const role = conversationRole(conversation, auth.userId) ?? 'buyer';
    const other = role === 'owner' ? conversation.buyerId : conversation.listingOwnerId;

    return NextResponse.json({
      conversation: {
        _id: String(conversation._id),
        yourRole: role,
        listing: shapeListingSummary(
          conversation.listingId as { _id?: unknown; title?: string; slug?: string | null }
        ),
        otherParty: shapeMessagePerson(
          other as { _id?: unknown; firstName?: string; name?: string; image?: string }
        ),
      },
      messages: messages.map(shapeMessage),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await requireVerifiedSession(req);
    if (!auth.ok) return auth.response;

    const { conversationId } = await params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 });
    }

    const payload = await req.json().catch(() => ({}));
    const text = sanitizeMessageBody((payload as { body?: unknown }).body);
    if (!text) {
      return NextResponse.json({ error: 'Enter a message (1–2000 characters).' }, { status: 400 });
    }

    await dbConnect();
    const conversation = await ListingConversation.findById(conversationId);
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.session.user.role !== 'admin' && !isConversationParticipant(conversation, auth.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const listing = await Listing.findById(conversation.listingId).select(MESSAGE_LISTING_FIELDS).lean();
    if (listing) {
      const ownerId = resolveListingOwnerId(listing);
      if (ownerId && String(conversation.listingOwnerId) !== ownerId) {
        conversation.listingOwnerId = new mongoose.Types.ObjectId(ownerId);
      }
    }

    const recent = await countRecentSenderMessages(conversationId, auth.userId);
    if (recent >= LISTING_MESSAGE_RATE_LIMIT) {
      return NextResponse.json(
        { error: 'You are sending messages too quickly. Try again shortly.' },
        { status: 429 }
      );
    }

    const message = await appendListingMessage({
      conversation,
      listingId: String(conversation.listingId),
      senderId: auth.userId,
      body: text,
    });

    const role = conversationRole(conversation, auth.userId) ?? 'buyer';
    const recipientId = role === 'owner' ? String(conversation.buyerId) : String(conversation.listingOwnerId);
    const [sender, recipient] = await Promise.all([
      User.findById(auth.userId).select('firstName name').lean(),
      User.findById(recipientId).select('firstName name email').lean(),
    ]);
    if (recipient?.email) {
      void sendListingMessageEmail({
        to: recipient.email,
        recipientName: recipient.firstName || recipient.name || 'there',
        senderName: sender?.firstName || sender?.name || 'A user',
        listingTitle: listing?.title || 'a listing',
        listingId: String(conversation.listingId),
        listingSlug: listing?.slug,
        preview: messagePreview(text),
        conversationId,
      }).catch((err) => console.error('[listing-message] email:', err));
    }

    const populated = await ListingMessage.findById(message._id).populate('senderId', MESSAGE_USER_FIELDS).lean();
    return NextResponse.json({
      conversationId,
      message: populated ? shapeMessage(populated) : shapeMessage(message),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
