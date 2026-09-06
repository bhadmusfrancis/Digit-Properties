import mongoose, { Schema, Model } from 'mongoose';
import { TREND_CATEGORIES, TREND_STATUS } from '@/lib/constants';

/** `source_editorial` is legacy (rehosted OG images); prefer licensed_third_party for new posts. */
export type TrendImageLicense =
  | 'unsplash'
  | 'ai_generated'
  | 'uploaded'
  | 'licensed_third_party'
  | 'source_editorial';

export interface ITrend {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: (typeof TREND_CATEGORIES)[number];
  imageUrl?: string;
  /** Display credit for the hero image. */
  imageCredit?: string;
  imageSourceName?: string;
  imageSourceUrl?: string;
  imageLicense?: TrendImageLicense;
  author?: string;
  status: (typeof TREND_STATUS)[keyof typeof TREND_STATUS];
  publishedAt?: Date;
  /** UTC date-only for the daily generation batch. */
  batchDate?: Date;
  sourceUrls?: string[];
  facebookPostId?: string;
  facebookPostedAt?: Date;
  instagramPostId?: string;
  instagramPermalink?: string;
  instagramPostedAt?: Date;
  twitterPostId?: string;
  twitterPostedAt?: Date;
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
    imageCredit: String,
    imageSourceName: String,
    imageSourceUrl: String,
    imageLicense: {
      type: String,
      enum: ['unsplash', 'ai_generated', 'uploaded', 'licensed_third_party', 'source_editorial'],
    },
    author: String,
    status: { type: String, enum: Object.values(TREND_STATUS), default: TREND_STATUS.DRAFT },
    publishedAt: Date,
    batchDate: Date,
    sourceUrls: { type: [String], default: undefined },
    facebookPostId: String,
    facebookPostedAt: Date,
    instagramPostId: String,
    instagramPermalink: String,
    instagramPostedAt: Date,
    twitterPostId: String,
    twitterPostedAt: Date,
  },
  { timestamps: true }
);

TrendSchema.index({ status: 1, publishedAt: -1 });
TrendSchema.index({ category: 1, status: 1 });
TrendSchema.index({ batchDate: 1, status: 1 });

const Trend: Model<ITrend> = mongoose.models.Trend ?? mongoose.model<ITrend>('Trend', TrendSchema);
export default Trend;
