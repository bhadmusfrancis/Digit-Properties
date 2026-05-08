import mongoose, { Schema, Model } from 'mongoose';

/** Single coupon redemption record (sub-document on a coupon). */
export interface ICouponRedemption {
  userId: mongoose.Types.ObjectId;
  redeemedAt: Date;
  walletTransactionId?: mongoose.Types.ObjectId;
}

/**
 * Admin-issued coupon code. Each code grants a fixed NGN amount that is
 * credited to the redeemer's Ad credit wallet.
 *
 * - `maxRedemptions` caps total uses across all users.
 * - Each user can redeem a given code at most once (enforced via `redemptions.userId`).
 */
export interface ICouponCode {
  _id: mongoose.Types.ObjectId;
  code: string;
  /** Amount (NGN) credited to a user's wallet on redemption. */
  amount: number;
  maxRedemptions: number;
  redeemedCount: number;
  /** Optional expiry date (UTC). After this date redemptions are rejected. */
  expiresAt?: Date;
  active: boolean;
  description?: string;
  createdBy: mongoose.Types.ObjectId;
  redemptions: ICouponRedemption[];
  createdAt: Date;
  updatedAt: Date;
}

const RedemptionSchema = new Schema<ICouponRedemption>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    redeemedAt: { type: Date, default: Date.now },
    walletTransactionId: { type: Schema.Types.ObjectId, ref: 'WalletTransaction' },
  },
  { _id: false }
);

const CouponCodeSchema = new Schema<ICouponCode>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    maxRedemptions: { type: Number, required: true, min: 1 },
    redeemedCount: { type: Number, default: 0, min: 0 },
    expiresAt: Date,
    active: { type: Boolean, default: true },
    description: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    redemptions: { type: [RedemptionSchema], default: [] },
  },
  { timestamps: true }
);

CouponCodeSchema.index({ active: 1, expiresAt: 1 });
CouponCodeSchema.index({ 'redemptions.userId': 1 });

const CouponCode: Model<ICouponCode> =
  mongoose.models.CouponCode ?? mongoose.model<ICouponCode>('CouponCode', CouponCodeSchema);
export default CouponCode;
