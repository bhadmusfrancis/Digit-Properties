import mongoose, { Schema, Model } from 'mongoose';

/**
 * Singleton document: how daily trend generation publishes posts.
 * If no row exists, code uses defaults (see getTrendConfig).
 */
export interface ITrendConfig {
  _id: mongoose.Types.ObjectId;
  /** When true, newly generated daily trends go live as published. */
  autoPublish: boolean;
  updatedAt: Date;
}

const TrendConfigSchema = new Schema<ITrendConfig>(
  {
    autoPublish: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const TrendConfig: Model<ITrendConfig> =
  mongoose.models.TrendConfig ?? mongoose.model<ITrendConfig>('TrendConfig', TrendConfigSchema);
export default TrendConfig;
