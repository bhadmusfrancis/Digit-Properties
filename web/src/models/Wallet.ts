import mongoose, { Schema, Model } from 'mongoose';

/**
 * Per-user Ad credit wallet. Balance is stored in NGN (whole units, no kobo).
 * One document per user; creation is on-demand (see `lib/wallet.ts`).
 */
export interface IWallet {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'NGN' },
  },
  { timestamps: true }
);

const Wallet: Model<IWallet> = mongoose.models.Wallet ?? mongoose.model<IWallet>('Wallet', WalletSchema);
export default Wallet;
