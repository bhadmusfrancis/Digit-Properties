import mongoose, { Schema, Model } from 'mongoose';

export interface IReview {
  _id: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  reviewerId: mongoose.Types.ObjectId;
  revieweeId: mongoose.Types.ObjectId;
  rating: number;
  text?: string;
  status: 'active' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revieweeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: String,
    status: { type: String, enum: ['active', 'hidden'], default: 'active' },
  },
  { timestamps: true }
);

ReviewSchema.index({ revieweeId: 1 });
ReviewSchema.index({ listingId: 1 });

const Review: Model<IReview> = mongoose.models.Review ?? mongoose.model<IReview>('Review', ReviewSchema);
export default Review;
