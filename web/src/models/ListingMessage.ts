import mongoose, { Schema, Model } from 'mongoose';

export const LISTING_MESSAGE_MAX_LEN = 2000;

export interface IListingMessage {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const ListingMessageSchema = new Schema<IListingMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'ListingConversation', required: true, index: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, maxlength: LISTING_MESSAGE_MAX_LEN },
  },
  { timestamps: true }
);

ListingMessageSchema.index({ conversationId: 1, createdAt: 1 });

const ListingMessage: Model<IListingMessage> =
  mongoose.models.ListingMessage ?? mongoose.model<IListingMessage>('ListingMessage', ListingMessageSchema);

export default ListingMessage;
