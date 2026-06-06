import mongoose, { Schema, Model } from 'mongoose';

/** Maps a deleted listing URL segment (slug, ObjectId, or prior slug) to a redirect target. */
export interface IListingPathRedirect {
  _id: mongoose.Types.ObjectId;
  pathSegment: string;
  destinationPath: string;
  listingId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ListingPathRedirectSchema = new Schema<IListingPathRedirect>(
  {
    pathSegment: { type: String, required: true, unique: true, trim: true, index: true },
    destinationPath: { type: String, required: true, trim: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ListingPathRedirect =
  (mongoose.models.ListingPathRedirect as Model<IListingPathRedirect>) ||
  mongoose.model<IListingPathRedirect>('ListingPathRedirect', ListingPathRedirectSchema);

export default ListingPathRedirect;
