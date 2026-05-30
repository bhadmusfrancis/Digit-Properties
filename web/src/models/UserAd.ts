import mongoose, { Schema, Model } from 'mongoose';
import { USER_AD_STATUS } from '@/lib/constants';
import { USER_AD_PLACEMENTS, type AdPlacement } from '@/lib/ad-placements';

export type { AdPlacement };
export type UserAdStatus = (typeof USER_AD_STATUS)[keyof typeof USER_AD_STATUS];

export interface IUserAd {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  placement: AdPlacement;
  /** Media: image or video (public_id + url from upload) */
  media: { public_id: string; url: string; type: 'image' | 'video' };
  startDate: Date;
  endDate: Date;
  targetUrl: string;
  status: UserAdStatus;
  amountPaid?: number;
  paymentId?: mongoose.Types.ObjectId;
  reviewedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserAdSchema = new Schema<IUserAd>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    placement: { type: String, enum: USER_AD_PLACEMENTS, required: true },
    media: {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
      type: { type: String, enum: ['image', 'video'], required: true },
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    targetUrl: { type: String, required: true },
    status: { type: String, enum: Object.values(USER_AD_STATUS), default: USER_AD_STATUS.PENDING_APPROVAL },
    amountPaid: Number,
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
  },
  { timestamps: true }
);

UserAdSchema.index({ placement: 1, status: 1, startDate: 1, endDate: 1 });
UserAdSchema.index({ userId: 1 });
UserAdSchema.index({ status: 1 });

const UserAd: Model<IUserAd> = mongoose.models.UserAd ?? mongoose.model<IUserAd>('UserAd', UserAdSchema);
export default UserAd;
