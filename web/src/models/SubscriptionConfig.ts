import mongoose, { Schema, Model } from 'mongoose';

export interface ISubscriptionConfig {
  tier: string;
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  canFeatured: boolean;
  canHighlighted: boolean;
  updatedAt: Date;
}

const SubscriptionConfigSchema = new Schema<ISubscriptionConfig>(
  {
    tier: { type: String, required: true, unique: true },
    maxListings: { type: Number, required: true },
    maxImages: { type: Number, required: true },
    maxVideos: { type: Number, required: true },
    canFeatured: { type: Boolean, default: false },
    canHighlighted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const SubscriptionConfig: Model<ISubscriptionConfig> =
  mongoose.models.SubscriptionConfig ??
  mongoose.model<ISubscriptionConfig>('SubscriptionConfig', SubscriptionConfigSchema);
export default SubscriptionConfig;
