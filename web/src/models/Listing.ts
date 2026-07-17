import mongoose, { Schema, Model } from 'mongoose';
import { LISTING_STATUS, LISTING_TYPE, PROPERTY_TYPES } from '@/lib/constants';
import { mongooseConn } from '@/lib/mongoose-conn';

export interface ILocation {
  address: string;
  city: string;
  state: string;
  suburb?: string;
  coordinates?: { lat: number; lng: number };
}

export interface IListing {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  listingType: (typeof LISTING_TYPE)[keyof typeof LISTING_TYPE];
  propertyType: (typeof PROPERTY_TYPES)[number];
  /** Up to 3 categories (primary is `propertyType`). */
  propertyTypes?: (typeof PROPERTY_TYPES)[number][];
  price: number;
  location: ILocation;
  bedrooms: number;
  bathrooms: number;
  toilets?: number;
  area?: number;
  amenities: string[];
  images: { public_id: string; url: string }[];
  videos?: { public_id: string; url: string }[];
  tags: string[];
  status: (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];
  createdBy: mongoose.Types.ObjectId;
  createdByType: 'admin' | 'ai' | 'bot' | 'user';
  /** Which contact details should be shown for this listing. */
  contactSource?: 'author' | 'listing';
  /**
   * Original chat/paste text when `description` was rewritten for SEO
   * (linked to All_chats.txt via `wa-fp:` tag).
   */
  originalDescription?: string;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  /** Rent period: day | month | year (for rent listings) */
  rentPeriod?: 'day' | 'month' | 'year';
  leaseDuration?: string;
  boostPackage?: 'starter' | 'pro' | 'premium';
  boostExpiresAt?: Date;
  /** Shown in home carousel when true (respects subscription maxFeatured). */
  featured?: boolean;
  /** Highlighted in search when true (respects subscription maxHighlighted). */
  highlighted?: boolean;
  /** SEO-friendly URL slug (unique when set). */
  slug?: string;
  /** Prior slugs that should 301 to the current slug (SEO / bookmark continuity). */
  previousSlugs?: string[];
  /** Why automated moderation sent this listing to pending approval. */
  pendingApprovalReasons?: string[];
  viewCount: number;
  soldAt?: Date;
  rentedAt?: Date;
  /** When ownership transferred to a user via claim (starts 24h owner edit window). */
  claimedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    suburb: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  { _id: false }
);

const ListingSchema = new Schema<IListing>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    listingType: { type: String, enum: Object.values(LISTING_TYPE), required: true },
    propertyType: { type: String, enum: PROPERTY_TYPES, required: true },
    propertyTypes: [{ type: String, enum: PROPERTY_TYPES }],
    price: { type: Number, required: true },
    location: { type: LocationSchema, required: true },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    toilets: { type: Number, default: 0 },
    area: Number,
    amenities: [{ type: String }],
    images: [
      {
        public_id: String,
        url: String,
      },
    ],
    videos: [
      {
        public_id: String,
        url: String,
      },
    ],
    tags: [{ type: String }],
    status: { type: String, enum: Object.values(LISTING_STATUS), default: LISTING_STATUS.DRAFT },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByType: { type: String, enum: ['admin', 'ai', 'bot', 'user'], default: 'user' },
    contactSource: { type: String, enum: ['author', 'listing'], default: 'author' },
    originalDescription: String,
    agentName: String,
    agentPhone: String,
    agentEmail: String,
    rentPeriod: { type: String, enum: ['day', 'month', 'year'] },
    leaseDuration: String,
    boostPackage: { type: String, enum: ['starter', 'pro', 'premium'] },
    boostExpiresAt: Date,
    featured: { type: Boolean, default: false },
    highlighted: { type: Boolean, default: false },
    slug: { type: String, trim: true, sparse: true, unique: true },
    previousSlugs: [{ type: String, trim: true }],
    pendingApprovalReasons: [{ type: String }],
    viewCount: { type: Number, default: 0 },
    soldAt: Date,
    rentedAt: Date,
    claimedAt: Date,
  },
  { timestamps: true }
);

ListingSchema.index({ status: 1, createdAt: -1 });
ListingSchema.index({ 'location.state': 1, status: 1 });
ListingSchema.index({ price: 1, status: 1 });
ListingSchema.index({ boostExpiresAt: 1 });
ListingSchema.index({ listingType: 1, status: 1 });
ListingSchema.index({ featured: 1, status: 1 });
ListingSchema.index({ highlighted: 1, status: 1 });
ListingSchema.index({ previousSlugs: 1 });
ListingSchema.index({ title: 'text', description: 'text', tags: 'text' });

const _m = mongooseConn();
const Listing: Model<IListing> = _m.models.Listing ?? _m.model<IListing>('Listing', ListingSchema);
export default Listing;
