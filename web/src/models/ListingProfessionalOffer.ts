import mongoose, { Schema, Model } from 'mongoose';

export const LISTING_OFFER_STATUS = {
  NEGOTIATING: 'negotiating',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  WITHDRAWN: 'withdrawn',
} as const;

export type ListingOfferStatus = (typeof LISTING_OFFER_STATUS)[keyof typeof LISTING_OFFER_STATUS];

export const LISTING_OFFER_TURN = {
  BUYER: 'buyer',
  SELLER: 'seller',
} as const;

export type ListingOfferTurn = (typeof LISTING_OFFER_TURN)[keyof typeof LISTING_OFFER_TURN];

export type OfferEventKind = 'created' | 'counter' | 'accepted' | 'declined' | 'withdrawn';

export interface IOfferEvent {
  at: Date;
  actorId: mongoose.Types.ObjectId;
  kind: OfferEventKind;
  amount?: number;
  message?: string;
}

export interface IListingProfessionalOffer {
  _id: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  amount: number;
  status: ListingOfferStatus;
  turn: ListingOfferTurn;
  listingPriceAtCreate: number;
  events: IOfferEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const OfferEventSchema = new Schema<IOfferEvent>(
  {
    at: { type: Date, default: () => new Date() },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['created', 'counter', 'accepted', 'declined', 'withdrawn'], required: true },
    amount: Number,
    message: { type: String, maxlength: 1000 },
  },
  { _id: false }
);

const ListingProfessionalOfferSchema = new Schema<IListingProfessionalOffer>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(LISTING_OFFER_STATUS),
      default: LISTING_OFFER_STATUS.NEGOTIATING,
      index: true,
    },
    turn: { type: String, enum: Object.values(LISTING_OFFER_TURN), required: true },
    listingPriceAtCreate: { type: Number, required: true },
    events: { type: [OfferEventSchema], default: [] },
  },
  { timestamps: true }
);

ListingProfessionalOfferSchema.index({ listingId: 1, status: 1 });
ListingProfessionalOfferSchema.index({ listingId: 1, buyerId: 1 });

const ListingProfessionalOffer: Model<IListingProfessionalOffer> =
  mongoose.models.ListingProfessionalOffer ??
  mongoose.model<IListingProfessionalOffer>('ListingProfessionalOffer', ListingProfessionalOfferSchema);

export default ListingProfessionalOffer;
