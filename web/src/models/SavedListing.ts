import mongoose, { Schema, Model } from 'mongoose';

export interface ISavedListing {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const SavedListingSchema = new Schema<ISavedListing>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  },
  { timestamps: true }
);

SavedListingSchema.index({ userId: 1, listingId: 1 }, { unique: true });

const SavedListing: Model<ISavedListing> =
  mongoose.models.SavedListing ?? mongoose.model<ISavedListing>('SavedListing', SavedListingSchema);
export default SavedListing;
