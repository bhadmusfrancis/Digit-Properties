import mongoose, { Schema, Model } from 'mongoose';
import { PAYMENT_PURPOSE } from '@/lib/constants';

export interface IPayment {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  gateway: 'flutterwave' | 'paystack';
  gatewayRef: string;
  purpose: (typeof PAYMENT_PURPOSE)[keyof typeof PAYMENT_PURPOSE];
  listingId?: mongoose.Types.ObjectId;
  status: 'pending' | 'success' | 'failed';
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },
    gateway: { type: String, enum: ['flutterwave', 'paystack'], required: true },
    gatewayRef: { type: String, required: true },
    purpose: { type: String, enum: Object.values(PAYMENT_PURPOSE), required: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing' },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    idempotencyKey: String,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true }
);

PaymentSchema.index({ gatewayRef: 1 }, { unique: true });
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ idempotencyKey: 1 });

const Payment: Model<IPayment> = mongoose.models.Payment ?? mongoose.model<IPayment>('Payment', PaymentSchema);
export default Payment;
