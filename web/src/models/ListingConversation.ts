import mongoose, { Schema, Model } from 'mongoose';

export interface IListingConversation {
  _id: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  listingOwnerId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  lastMessageAt: Date;
  lastMessagePreview: string;
  lastSenderId?: mongoose.Types.ObjectId;
  unreadByOwner: number;
  unreadByBuyer: number;
  createdAt: Date;
  updatedAt: Date;
}

const ListingConversationSchema = new Schema<IListingConversation>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    listingOwnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, default: '', maxlength: 200 },
    lastSenderId: { type: Schema.Types.ObjectId, ref: 'User' },
    unreadByOwner: { type: Number, default: 0, min: 0 },
    unreadByBuyer: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

ListingConversationSchema.index({ listingId: 1, buyerId: 1 }, { unique: true });
ListingConversationSchema.index({ listingOwnerId: 1, lastMessageAt: -1 });
ListingConversationSchema.index({ buyerId: 1, lastMessageAt: -1 });

const ListingConversation: Model<IListingConversation> =
  mongoose.models.ListingConversation ??
  mongoose.model<IListingConversation>('ListingConversation', ListingConversationSchema);

export default ListingConversation;
