import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import ListingProfessionalOffer from '@/models/ListingProfessionalOffer';
import { LISTING_OFFER_STATUS, LISTING_OFFER_TURN } from '@/models/ListingProfessionalOffer';

type PopulatedUser = {
  _id?: unknown;
  name?: string;
  firstName?: string;
};

type PopulatedListing = {
  _id?: unknown;
  title?: string;
};

function userSummary(user: unknown) {
  if (!user || typeof user !== 'object') return null;
  const row = user as PopulatedUser;
  return {
    _id: row._id ? String(row._id) : '',
    name: typeof row.name === 'string' ? row.name : '',
    firstName: typeof row.firstName === 'string' ? row.firstName : '',
  };
}

function listingSummary(listing: unknown) {
  if (!listing || typeof listing !== 'object') return null;
  const row = listing as PopulatedListing;
  return {
    _id: row._id ? String(row._id) : '',
    title: typeof row.title === 'string' ? row.title : 'Listing',
  };
}

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    const uid = session?.user?.id;
    if (!uid || !mongoose.Types.ObjectId.isValid(uid)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const userOid = new mongoose.Types.ObjectId(uid);
    const raw = await ListingProfessionalOffer.find({
      $or: [{ buyerId: userOid }, { sellerId: userOid }],
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .populate('listingId', 'title')
      .populate('buyerId', 'name firstName')
      .populate('sellerId', 'name firstName')
      .lean();

    const offers = raw.map((o) => {
      const listingId = String(o.listingId && typeof o.listingId === 'object' && '_id' in o.listingId ? o.listingId._id : o.listingId);
      const isBuyer = String(o.buyerId && typeof o.buyerId === 'object' && '_id' in o.buyerId ? o.buyerId._id : o.buyerId) === uid;
      const negotiating = o.status === LISTING_OFFER_STATUS.NEGOTIATING;
      const canCounter = negotiating && ((isBuyer && o.turn === LISTING_OFFER_TURN.BUYER) || (!isBuyer && o.turn === LISTING_OFFER_TURN.SELLER));
      const canAccept = negotiating && !isBuyer && o.turn === LISTING_OFFER_TURN.SELLER;
      const canDecline = canAccept;
      const canWithdraw = negotiating && isBuyer;

      return {
        _id: String(o._id),
        listingId,
        listing: listingSummary(o.listingId),
        amount: o.amount,
        status: o.status,
        turn: o.turn,
        listingPriceAtCreate: o.listingPriceAtCreate,
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : undefined,
        updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : undefined,
        yourRole: isBuyer ? 'buyer' : 'seller',
        buyer: userSummary(o.buyerId),
        seller: userSummary(o.sellerId),
        canCounter,
        canAccept,
        canDecline,
        canWithdraw,
      };
    });

    return NextResponse.json({ offers });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load dashboard offers' }, { status: 500 });
  }
}

