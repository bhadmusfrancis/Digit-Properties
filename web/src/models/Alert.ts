import mongoose, { Schema, Model } from 'mongoose';

export interface IAlert {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  filters: {
    listingType?: string;
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    state?: string;
    city?: string;
    bedrooms?: number;
    bathrooms?: number;
    tags?: string[];
  };
  notifyPush: boolean;
  notifyEmail: boolean;
  lastNotifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    filters: Schema.Types.Mixed,
    notifyPush: { type: Boolean, default: true },
    notifyEmail: { type: Boolean, default: true },
    lastNotifiedAt: Date,
  },
  { timestamps: true }
);

AlertSchema.index({ userId: 1 });
AlertSchema.index({ lastNotifiedAt: 1 });

const Alert: Model<IAlert> = mongoose.models.Alert ?? mongoose.model<IAlert>('Alert', AlertSchema);
export default Alert;
