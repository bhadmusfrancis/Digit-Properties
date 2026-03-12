import mongoose, { Schema, Model } from 'mongoose';

export interface IClaimPhoneVerification {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Normalized phone (E.164 without +, e.g. 2348012345678) */
  phone: string;
  verifiedAt: Date;
}

const ClaimPhoneVerificationSchema = new Schema<IClaimPhoneVerification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    phone: { type: String, required: true },
    verifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

ClaimPhoneVerificationSchema.index({ userId: 1, phone: 1 }, { unique: true });

const ClaimPhoneVerification: Model<IClaimPhoneVerification> =
  mongoose.models.ClaimPhoneVerification ??
  mongoose.model<IClaimPhoneVerification>('ClaimPhoneVerification', ClaimPhoneVerificationSchema);
export default ClaimPhoneVerification;
