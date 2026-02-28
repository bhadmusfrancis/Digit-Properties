import mongoose, { Schema, Model } from 'mongoose';
import { TREND_CATEGORIES, TREND_STATUS } from '@/lib/constants';

export interface ITrend {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: (typeof TREND_CATEGORIES)[number];
  imageUrl?: string;
  author?: string;
  status: (typeof TREND_STATUS)[keyof typeof TREND_STATUS];
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TrendSchema = new Schema<ITrend>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, required: true, default: '' },
    content: { type: String, required: true, default: '' },
    category: { type: String, required: true, enum: TREND_CATEGORIES },
    imageUrl: String,
    author: String,
    status: { type: String, enum: Object.values(TREND_STATUS), default: TREND_STATUS.DRAFT },
    publishedAt: Date,
  },
  { timestamps: true }
);

TrendSchema.index({ status: 1, publishedAt: -1 });
TrendSchema.index({ category: 1, status: 1 });
TrendSchema.index({ slug: 1 });

const Trend: Model<ITrend> = mongoose.models.Trend ?? mongoose.model<ITrend>('Trend', TrendSchema);
export default Trend;
