import mongoose, { Schema, Model } from 'mongoose';
import { AD_PLACEMENTS } from '@/lib/constants';

export type AdPlacementKey = (typeof AD_PLACEMENTS)[number];

export interface PlacementPricing {
  pricePerDay: number;
  pricePerHour: number;
  currency: string;
}

export interface IAdConfig {
  _id: mongoose.Types.ObjectId;
  /** Placement pricing: key = placement id, value = { pricePerDay, pricePerHour, currency } */
  placementPricing: Record<AdPlacementKey, PlacementPricing>;
  /** AdSense HTML/snippet per placement (optional). Key = placement id. */
  adsense: Record<AdPlacementKey, string>;
  updatedAt: Date;
}

const PlacementPricingSchema = new Schema(
  { pricePerDay: Number, pricePerHour: Number, currency: { type: String, default: 'NGN' } },
  { _id: false }
);

function defaultPlacementPricing(): Record<string, PlacementPricing> {
  const o: Record<string, PlacementPricing> = {};
  for (const p of AD_PLACEMENTS) {
    o[p] = { pricePerDay: 5000, pricePerHour: 500, currency: 'NGN' };
  }
  return o;
}

const AdConfigSchema = new Schema<IAdConfig>(
  {
    placementPricing: { type: Schema.Types.Mixed, default: defaultPlacementPricing },
    adsense: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

const AdConfig: Model<IAdConfig> = mongoose.models.AdConfig ?? mongoose.model<IAdConfig>('AdConfig', AdConfigSchema);
export default AdConfig;
