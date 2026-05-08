import mongoose, { Schema, Model } from 'mongoose';
import { WALLET_TX_TYPES, WALLET_TX_REASONS } from '@/lib/constants';

/**
 * Append-only ledger of every wallet credit / debit. Used for the user's
 * transaction history and for admin auditing.
 */
export interface IWalletTransaction {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  walletId: mongoose.Types.ObjectId;
  /** Always positive. The `type` field describes credit vs debit. */
  amount: number;
  type: (typeof WALLET_TX_TYPES)[keyof typeof WALLET_TX_TYPES];
  reason: (typeof WALLET_TX_REASONS)[keyof typeof WALLET_TX_REASONS];
  /** Wallet balance immediately after this entry was applied. */
  balanceAfter: number;
  description?: string;
  paymentId?: mongoose.Types.ObjectId;
  couponId?: mongoose.Types.ObjectId;
  listingId?: mongoose.Types.ObjectId;
  adId?: mongoose.Types.ObjectId;
  /** Admin who performed the action (for `admin_credit` / `admin_debit` / `adjustment`). */
  adminId?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: Object.values(WALLET_TX_TYPES), required: true },
    reason: { type: String, enum: Object.values(WALLET_TX_REASONS), required: true },
    balanceAfter: { type: Number, required: true },
    description: String,
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    couponId: { type: Schema.Types.ObjectId, ref: 'CouponCode' },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing' },
    adId: { type: Schema.Types.ObjectId, ref: 'UserAd' },
    adminId: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true }
);

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });

const WalletTransaction: Model<IWalletTransaction> =
  mongoose.models.WalletTransaction ??
  mongoose.model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);
export default WalletTransaction;
