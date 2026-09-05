import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import ListingConversation from '@/models/ListingConversation';
import ListingMessage from '@/models/ListingMessage';
import User from '@/models/User';
import { requireVerifiedSession } from '@/lib/require-verified-session';
import { canViewListingOnSite } from '@/lib/listing-access';
import { findListingByPublicParam } from '@/lib/resolve-listing';
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
  unreadForUser,
} from '@/lib/listing-messages';

async function loadListing(id: string) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return Listing.findById(id).select(MESSAGE_LISTING_FIELDS).lean();
  }
  const found = await findListingByPublicParam(id);
  if (found.type === 'gone') return null;
  return Listing.findById(found.listing._id).select(MESSAGE_LISTING_FIELDS).lean();
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireVerifiedSession(req);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    await dbConnect();
    const listing = await loadListing(id);
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canViewListingOnSite({ status: listing.status, createdBy: listing.createdBy, session: auth.session })) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const listingId = String(listing._id);
    const ownerId = resolveListingOwnerId(listing);
    const isOwner = ownerId === auth.userId || auth.session.user.role === 'admin';
    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId');

    if (isOwner) {
      if (conversationId) {
        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
          return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 });
        }
        const conversation = await ListingConversation.findOne({
          _id: conversationId,
          listingId,
        })
          .populate('buyerId', MESSAGE_USER_FIELDS)
          .populate('listingOwnerId', MESSAGE_USER_FIELDS)
          .lean();
        if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (
          auth.session.user.role !== 'admin' &&
          !isConversationParticipant(conversation, auth.userId)
        ) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        await markConversationRead(conversationId, auth.userId);
        const messages = await ListingMessage.find({ conversationId })
          .sort({ createdAt: 1 })
          .limit(200)
          .populate('senderId', MESSAGE_USER_FIELDS)
          .lean();
        return NextResponse.json({
          role: 'owner',
          listing: shapeListingSummary(listing),
          conversation: {
            _id: String(conversation._id),
            yourRole: 'owner',
            otherParty: shapeMessagePerson(conversation.buyerId as { _id?: unknown; firstName?: string; name?: string; image?: string }),
            lastMessageAt: conversation.lastMessageAt,
            unreadCount: 0,
          },
          messages: messages.map(shapeMessage),
        });
      }

      const conversations = await ListingConversation.find({ listingId })
        .sort({ lastMessageAt: -1 })
        .limit(100)
        .populate('buyerId', MESSAGE_USER_FIELDS)
        .lean();

      return NextResponse.json({
        role: 'owner',
        listing: shapeListingSummary(listing),
        conversations: conversations.map((c) => ({
          _id: String(c._id),
          yourRole: 'owner',
          otherParty: shapeMessagePerson(c.buyerId as { _id?: unknown; firstName?: string; name?: string; image?: string }),
          lastMessagePreview: c.lastMessagePreview,
          lastMessageAt: c.lastMessageAt,
          unreadCount: unreadForUser(c, auth.userId),
        })),
        conversation: null,
        messages: [],
      });
    }

    const conversation = await ListingConversation.findOne({ listingId, buyerId: auth.userId })
      .populate('buyerId', MESSAGE_USER_FIELDS)
      .populate('listingOwnerId', MESSAGE_USER_FIELDS)
      .lean();

    if (!conversation) {
      return NextResponse.json({
        role: 'buyer',
        listing: shapeListingSummary(listing),
        conversation: null,
        messages: [],
      });
    }

    await markConversationRead(String(conversation._id), auth.userId);
    const messages = await ListingMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('senderId', MESSAGE_USER_FIELDS)
      .lean();

    return NextResponse.json({
      role: 'buyer',
      listing: shapeListingSummary(listing),
      conversation: {
        _id: String(conversation._id),
        yourRole: 'buyer',
        otherParty: shapeMessagePerson(
          conversation.listingOwnerId as { _id?: unknown; firstName?: string; name?: string; image?: string }
        ),
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: 0,
      },
      messages: messages.map(shapeMessage),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireVerifiedSession(req);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const text = sanitizeMessageBody((body as { body?: unknown }).body);
    if (!text) {
      return NextResponse.json({ error: 'Enter a message (1–2000 characters).' }, { status: 400 });
    }

    await dbConnect();
    const listing = await loadListing(id);
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canViewListingOnSite({ status: listing.status, createdBy: listing.createdBy, session: auth.session })) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const listingId = String(listing._id);
    const ownerId = resolveListingOwnerId(listing);
    if (!ownerId) {
      return NextResponse.json({ error: 'This listing has no owner to message.' }, { status: 400 });
    }

    const requestedConversationId =
      typeof (body as { conversationId?: unknown }).conversationId === 'string'
        ? (body as { conversationId: string }).conversationId
        : '';

    let conversation = requestedConversationId && mongoose.Types.ObjectId.isValid(requestedConversationId)
      ? await ListingConversation.findOne({ _id: requestedConversationId, listingId })
      : null;

    if (conversation) {
      if (!isConversationParticipant(conversation, auth.userId) && auth.session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      if (ownerId === auth.userId) {
        return NextResponse.json(
          { error: 'You cannot start a conversation on your own listing.' },
          { status: 400 }
        );
      }
      conversation = await ListingConversation.findOne({ listingId, buyerId: auth.userId });
      if (!conversation) {
        conversation = await ListingConversation.create({
          listingId,
          listingOwnerId: ownerId,
          buyerId: auth.userId,
          lastMessageAt: new Date(),
          lastMessagePreview: messagePreview(text),
        });
      }
    }

    if (String(conversation.listingOwnerId) !== ownerId) {
      conversation.listingOwnerId = new mongoose.Types.ObjectId(ownerId);
    }

    const recent = await countRecentSenderMessages(String(conversation._id), auth.userId);
    if (recent >= LISTING_MESSAGE_RATE_LIMIT) {
      return NextResponse.json(
        { error: 'You are sending messages too quickly. Try again shortly.' },
        { status: 429 }
      );
    }

    const message = await appendListingMessage({
      conversation,
      listingId,
      senderId: auth.userId,
      body: text,
    });

    const role = conversationRole(conversation, auth.userId) ?? 'buyer';
    const recipientId = role === 'owner' ? String(conversation.buyerId) : String(conversation.listingOwnerId);
    const [sender, recipient] = await Promise.all([
      User.findById(auth.userId).select('firstName name email').lean(),
      User.findById(recipientId).select('firstName name email').lean(),
    ]);
    if (recipient?.email) {
      void sendListingMessageEmail({
        to: recipient.email,
        recipientName: recipient.firstName || recipient.name || 'there',
        senderName: sender?.firstName || sender?.name || 'A user',
        listingTitle: listing.title || 'a listing',
        listingId,
        listingSlug: listing.slug,
        preview: messagePreview(text),
        conversationId: String(conversation._id),
      }).catch((err) => console.error('[listing-message] email:', err));
    }

    const populated = await ListingMessage.findById(message._id).populate('senderId', MESSAGE_USER_FIELDS).lean();

    return NextResponse.json({
      conversationId: String(conversation._id),
      message: populated ? shapeMessage(populated) : shapeMessage(message),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
