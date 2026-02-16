import mongoose, { Schema, Model } from 'mongoose';

export interface IBanner {
  _id: mongoose.Types.ObjectId;
  slot: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    slot: { type: String, required: true },
    imageUrl: { type: String, required: true },
    linkUrl: String,
    isActive: { type: Boolean, default: true },
    startDate: Date,
    endDate: Date,
  },
  { timestamps: true }
);

BannerSchema.index({ slot: 1, isActive: 1 });

const Banner: Model<IBanner> = mongoose.models.Banner ?? mongoose.model<IBanner>('Banner', BannerSchema);
export default Banner;
