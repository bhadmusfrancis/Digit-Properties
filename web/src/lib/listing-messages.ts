import mongoose, { type HydratedDocument } from 'mongoose';
import ListingConversation, { type IListingConversation } from '@/models/ListingConversation';
import ListingMessage, { LISTING_MESSAGE_MAX_LEN } from '@/models/ListingMessage';
import { getListingCreatedById } from '@/lib/listing-access';
import { toFirstName } from '@/lib/display-name';
import { getListingPublicPath } from '@/lib/listing-path';

export const LISTING_MESSAGE_RATE_LIMIT = 40;
export const LISTING_MESSAGE_PREVIEW_LEN = 140;

export function sanitizeMessageBody(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  if (text.length < 1 || text.length > LISTING_MESSAGE_MAX_LEN) return null;
  return text;
}

export function messagePreview(body: string): string {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (compact.length <= LISTING_MESSAGE_PREVIEW_LEN) return compact;
  return `${compact.slice(0, LISTING_MESSAGE_PREVIEW_LEN - 1).trim()}…`;
}

export function conversationParticipantIds(conversation: {
  buyerId: unknown;
  listingOwnerId: unknown;
}): string[] {
  return [String(conversation.buyerId), String(conversation.listingOwnerId)].filter(Boolean);
}

export function isConversationParticipant(
  conversation: { buyerId: unknown; listingOwnerId: unknown },
  userId: string
): boolean {
  return conversationParticipantIds(conversation).includes(userId);
}

export function conversationRole(
  conversation: { buyerId: unknown; listingOwnerId: unknown },
  userId: string
): 'buyer' | 'owner' | null {
  if (String(conversation.buyerId) === userId) return 'buyer';
  if (String(conversation.listingOwnerId) === userId) return 'owner';
  return null;
}

type PersonLean = {
  _id?: unknown;
  firstName?: string;
  name?: string;
  image?: string | null;
};

export function shapeMessagePerson(user: PersonLean | null | undefined) {
  if (!user?._id) return null;
  return {
    _id: String(user._id),
    name: toFirstName(user.firstName, user.name, 'User'),
    image: user.image ?? null,
  };
}

export function shapeListingSummary(listing: {
  _id?: unknown;
  title?: string;
  slug?: string | null;
} | null) {
  if (!listing?._id) return null;
  return {
    _id: String(listing._id),
    title: listing.title || 'Listing',
    slug: listing.slug ?? null,
    path: getListingPublicPath({ _id: String(listing._id), slug: listing.slug }),
  };
}

export function shapeMessage(doc: {
  _id: unknown;
  senderId: unknown;
  body: string;
  createdAt?: Date;
}) {
  const sender =
    doc.senderId && typeof doc.senderId === 'object' && '_id' in (doc.senderId as object)
      ? shapeMessagePerson(doc.senderId as PersonLean)
      : { _id: String(doc.senderId), name: 'User', image: null };
  return {
    _id: String(doc._id),
    sender,
    body: doc.body,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  };
}

export function unreadForUser(
  conversation: { unreadByOwner?: number; unreadByBuyer?: number; buyerId: unknown; listingOwnerId: unknown },
  userId: string
): number {
  const role = conversationRole(conversation, userId);
  if (role === 'owner') return conversation.unreadByOwner ?? 0;
  if (role === 'buyer') return conversation.unreadByBuyer ?? 0;
  return 0;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const conversation = await ListingConversation.findById(conversationId);
  if (!conversation || !isConversationParticipant(conversation, userId)) return null;
  const role = conversationRole(conversation, userId);
  if (role === 'owner' && conversation.unreadByOwner > 0) {
    conversation.unreadByOwner = 0;
    await conversation.save();
  } else if (role === 'buyer' && conversation.unreadByBuyer > 0) {
    conversation.unreadByBuyer = 0;
    await conversation.save();
  }
  return conversation;
}

export async function countRecentSenderMessages(conversationId: string, senderId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  return ListingMessage.countDocuments({
    conversationId,
    senderId,
    createdAt: { $gte: since },
  });
}

export async function appendListingMessage(args: {
  conversation: HydratedDocument<IListingConversation>;
  listingId: string;
  senderId: string;
  body: string;
}) {
  const message = await ListingMessage.create({
    conversationId: args.conversation._id,
    listingId: args.listingId,
    senderId: args.senderId,
    body: args.body,
  });

  const senderIsOwner = String(args.conversation.listingOwnerId) === args.senderId;
  args.conversation.lastMessageAt = new Date();
  args.conversation.lastMessagePreview = messagePreview(args.body);
  args.conversation.lastSenderId = new mongoose.Types.ObjectId(args.senderId);
  if (senderIsOwner) {
    args.conversation.unreadByBuyer = (args.conversation.unreadByBuyer || 0) + 1;
  } else {
    args.conversation.unreadByOwner = (args.conversation.unreadByOwner || 0) + 1;
  }
  await args.conversation.save();
  return message;
}

export function resolveListingOwnerId(listing: { createdBy?: unknown }): string {
  return getListingCreatedById(listing.createdBy);
}

export const MESSAGE_USER_FIELDS = 'firstName name image';
export const MESSAGE_LISTING_FIELDS = 'title slug createdBy status';
