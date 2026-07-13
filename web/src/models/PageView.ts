import mongoose, { Schema, Model } from 'mongoose';

export interface IPageView {
  _id: mongoose.Types.ObjectId;
  path: string;
  referrer?: string;
  country: string;
  countryName: string;
  sessionId: string;
  userId?: mongoose.Types.ObjectId;
  userAgent?: string;
  createdAt: Date;
}

const PageViewSchema = new Schema<IPageView>(
  {
    path: { type: String, required: true, trim: true },
    referrer: { type: String, trim: true },
    country: { type: String, required: true, default: 'XX', uppercase: true },
    countryName: { type: String, required: true, default: 'Unknown' },
    sessionId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PageViewSchema.index({ createdAt: -1 });
PageViewSchema.index({ path: 1, createdAt: -1 });
PageViewSchema.index({ country: 1, createdAt: -1 });
PageViewSchema.index({ sessionId: 1, path: 1, createdAt: -1 });

const PageView: Model<IPageView> =
  mongoose.models.PageView ?? mongoose.model<IPageView>('PageView', PageViewSchema);
export default PageView;
