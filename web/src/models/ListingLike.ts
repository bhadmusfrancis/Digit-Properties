import mongoose, { Schema, Model } from 'mongoose';

export interface IListingLike {
  userId: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ListingLikeSchema = new Schema<IListingLike>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  },
  { timestamps: true }
);

ListingLikeSchema.index({ listingId: 1, userId: 1 }, { unique: true });

const ListingLike: Model<IListingLike> =
  mongoose.models.ListingLike ?? mongoose.model<IListingLike>('ListingLike', ListingLikeSchema);
export default ListingLike;
