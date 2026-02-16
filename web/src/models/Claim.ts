import mongoose, { Schema, Model } from 'mongoose';
import { CLAIM_STATUS } from '@/lib/constants';

export interface IClaim {
  _id: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  proofUrls: string[];
  message?: string;
  status: (typeof CLAIM_STATUS)[keyof typeof CLAIM_STATUS];
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimSchema = new Schema<IClaim>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    proofUrls: [{ type: String }],
    message: String,
    status: { type: String, enum: Object.values(CLAIM_STATUS), default: CLAIM_STATUS.PENDING },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectionReason: String,
  },
  { timestamps: true }
);

ClaimSchema.index({ listingId: 1 });
ClaimSchema.index({ userId: 1 });
ClaimSchema.index({ status: 1 });

const Claim: Model<IClaim> = mongoose.models.Claim ?? mongoose.model<IClaim>('Claim', ClaimSchema);
export default Claim;
