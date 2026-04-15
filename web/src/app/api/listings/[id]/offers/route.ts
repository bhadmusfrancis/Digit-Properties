import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import ListingProfessionalOffer from '@/models/ListingProfessionalOffer';
import { canViewListingOnSite } from '@/lib/listing-access';
import { LISTING_STATUS, LISTING_TYPE } from '@/lib/constants';
import { listingOfferCreateSchema } from '@/lib/validations';
import { isPublicVerifiedAccount, shapePublicCreatedBy, USER_PUBLIC_BADGE_FIELDS } from '@/lib/verification';
import { LISTING_OFFER_STATUS, LISTING_OFFER_TURN } from '@/models/ListingProfessionalOffer';
import { sendProfessionalOfferNewEmail } from '@/lib/email';

function serializeOffer(doc: {
  _id: unknown;
  amount: number;
  status: string;
  turn: string;
  listingPriceAtCreate: number;
  createdAt?: Date;
  updatedAt?: Date;
  buyerId?: unknown;
}) {
  const buyer = doc.buyerId && typeof doc.buyerId === 'object' ? shapePublicCreatedBy(doc.buyerId) : null;
  return {
    _id: String(doc._id),
    amount: doc.amount,
    status: doc.status,
    turn: doc.turn,
    listingPriceAtCreate: doc.listingPriceAtCreate,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
    buyer,
  };
}

async function loadListingForOffers(listingId: string) {
  void User;
  const listing = await Listing.findById(listingId).populate('createdBy', USER_PUBLIC_BADGE_FIELDS).lean();
  if (!listing) return null;
  const seller = shapePublicCreatedBy(listing.createdBy);
  const sellerId =
    listing.createdBy && typeof listing.createdBy === 'object' && '_id' in listing.createdBy
      ? String((listing.createdBy as { _id: unknown })._id)
      : String(listing.createdBy);
  const soldAt = (listing as { soldAt?: Date | string | null }).soldAt;
  const offersEnabled =
    listing.status === LISTING_STATUS.ACTIVE &&
    !soldAt &&
    listing.listingType === LISTING_TYPE.SALE &&
    !!seller?.isVerifiedAccount;
  return { listing, sellerId, offersEnabled, listingPrice: listing.price, listingTitle: listing.title };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }
    const session = await getSession(req);
    await dbConnect();
    const meta = await loadListingForOffers(listingId);
    if (!meta) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { listing, offersEnabled, listingPrice } = meta;
    if (
      !canViewListingOnSite({
        status: listing.status,
        createdBy: listing.createdBy,
        session,
      })
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const lid = new mongoose.Types.ObjectId(listingId);
    const ownerId = meta.sellerId;
    const uid = session?.user?.id;

    let offersRaw: unknown[] = [];
    if (uid && ownerId === uid) {
      offersRaw = await ListingProfessionalOffer.find({ listingId: lid })
        .sort({ updatedAt: -1 })
        .limit(40)
        .populate('buyerId', USER_PUBLIC_BADGE_FIELDS)
        .lean();
    } else if (uid) {
      offersRaw = await ListingProfessionalOffer.find({
        listingId: lid,
        buyerId: new mongoose.Types.ObjectId(uid),
      })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('buyerId', USER_PUBLIC_BADGE_FIELDS)
        .lean();
    }

    const offers = offersRaw.map((o) => serializeOffer(o as Parameters<typeof serializeOffer>[0]));
    return NextResponse.json({ offersEnabled, listingPrice, offers });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load offers' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in to send a professional offer' }, { status: 401 });
    }

    const { id: listingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = listingOfferCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { amount, message } = parsed.data;

    await dbConnect();
    const meta = await loadListingForOffers(listingId);
    if (!meta) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { listing, sellerId, offersEnabled, listingPrice, listingTitle } = meta;

    if (
      !canViewListingOnSite({
        status: listing.status,
        createdBy: listing.createdBy,
        session,
      })
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!offersEnabled) {
      return NextResponse.json(
        { error: 'Professional offers are only available on active for-sale listings from verified sellers.' },
        { status: 403 }
      );
    }

    if (sellerId === session.user.id) {
      return NextResponse.json({ error: 'You cannot make an offer on your own listing' }, { status: 403 });
    }

    const sellerUser = await User.findById(sellerId).select(USER_PUBLIC_BADGE_FIELDS).lean();
    if (!sellerUser || !isPublicVerifiedAccount(sellerUser)) {
      return NextResponse.json({ error: 'Seller is not eligible for professional offers' }, { status: 403 });
    }

    const buyerOid = new mongoose.Types.ObjectId(session.user.id);
    const lid = new mongoose.Types.ObjectId(listingId);

    const existing = await ListingProfessionalOffer.findOne({
      listingId: lid,
      buyerId: buyerOid,
      status: LISTING_OFFER_STATUS.NEGOTIATING,
    }).lean();
    if (existing) {
      return NextResponse.json(
        { error: 'You already have an open offer on this listing. Update it from your offer thread instead.', offerId: String(existing._id) },
        { status: 409 }
      );
    }

    const doc = await ListingProfessionalOffer.create({
      listingId: lid,
      buyerId: buyerOid,
      sellerId: new mongoose.Types.ObjectId(sellerId),
      amount,
      status: LISTING_OFFER_STATUS.NEGOTIATING,
      turn: LISTING_OFFER_TURN.SELLER,
      listingPriceAtCreate: listingPrice,
      events: [
        {
          actorId: buyerOid,
          kind: 'created',
          amount,
          message: message?.trim() || undefined,
        },
      ],
    });

    const populated = await ListingProfessionalOffer.findById(doc._id).populate('buyerId', USER_PUBLIC_BADGE_FIELDS).lean();

    const [sellerFull, buyerFull] = await Promise.all([
      User.findById(sellerId).select('name email').lean(),
      User.findById(session.user.id).select('name email').lean(),
    ]);
    const sellerEmail = typeof sellerFull?.email === 'string' ? sellerFull.email : '';
    if (sellerEmail) {
      sendProfessionalOfferNewEmail({
        to: sellerEmail,
        recipientName: (typeof sellerFull?.name === 'string' && sellerFull.name) || 'Seller',
        buyerName: (typeof buyerFull?.name === 'string' && buyerFull.name) || session.user.name || 'Buyer',
        listingTitle: listingTitle || listing.title,
        listingId,
        offerAmount: amount,
      }).catch((e) => console.error('[offers] new offer email:', e));
    }

    return NextResponse.json({ offer: populated ? serializeOffer(populated as Parameters<typeof serializeOffer>[0]) : null });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 });
  }
}
