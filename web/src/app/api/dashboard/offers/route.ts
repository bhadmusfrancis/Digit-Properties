import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import ListingProfessionalOffer from '@/models/ListingProfessionalOffer';
import Listing from '@/models/Listing';
import User from '@/models/User';
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
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    // Be tolerant of legacy/non-ObjectId user ids: return a valid empty payload
    // instead of failing the dashboard for listing owners.
    if (!mongoose.Types.ObjectId.isValid(uid)) {
      return NextResponse.json({ offers: [] });
    }
    const userOid = new mongoose.Types.ObjectId(uid);
    const raw = await ListingProfessionalOffer.find({
      $or: [{ buyerId: userOid }, { sellerId: userOid }],
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    const listingIds = new Set<string>();
    const userIds = new Set<string>();
    raw.forEach((o) => {
      const listingId = String(o.listingId ?? '');
      const buyerId = String(o.buyerId ?? '');
      const sellerId = String(o.sellerId ?? '');
      if (mongoose.Types.ObjectId.isValid(listingId)) listingIds.add(listingId);
      if (mongoose.Types.ObjectId.isValid(buyerId)) userIds.add(buyerId);
      if (mongoose.Types.ObjectId.isValid(sellerId)) userIds.add(sellerId);
    });

    const [listings, users] = await Promise.all([
      listingIds.size
        ? Listing.find({ _id: { $in: [...listingIds].map((id) => new mongoose.Types.ObjectId(id)) } })
            .select('title')
            .lean()
        : Promise.resolve([]),
      userIds.size
        ? User.find({ _id: { $in: [...userIds].map((id) => new mongoose.Types.ObjectId(id)) } })
            .select('name firstName')
            .lean()
        : Promise.resolve([]),
    ]);

    const listingById = new Map<string, unknown>();
    listings.forEach((l) => listingById.set(String((l as { _id: unknown })._id), l));
    const userById = new Map<string, unknown>();
    users.forEach((u) => userById.set(String((u as { _id: unknown })._id), u));

    const offers = raw.map((o) => {
      const listingId = String(o.listingId ?? '');
      const buyerId = String(o.buyerId ?? '');
      const sellerId = String(o.sellerId ?? '');
      const isBuyer = buyerId === uid;
      const negotiating = o.status === LISTING_OFFER_STATUS.NEGOTIATING;
      const latestEvent = Array.isArray(o.events) && o.events.length > 0 ? o.events[o.events.length - 1] : null;
      const sellerCounterLocked = latestEvent?.kind === 'maintained';
      const maintainAmount =
        isBuyer && o.turn === LISTING_OFFER_TURN.BUYER && Array.isArray(o.events)
          ? [...o.events]
              .reverse()
              .find(
                (ev) =>
                  String(ev?.actorId ?? '') === buyerId &&
                  (ev?.kind === 'created' || ev?.kind === 'counter' || ev?.kind === 'maintained') &&
                  typeof ev?.amount === 'number' &&
                  (ev.amount as number) > 0
              )?.amount
          : undefined;
      const canCounter =
        negotiating &&
        ((isBuyer && o.turn === LISTING_OFFER_TURN.BUYER) || (!isBuyer && o.turn === LISTING_OFFER_TURN.SELLER && !sellerCounterLocked));
      const canMaintain = negotiating && isBuyer && o.turn === LISTING_OFFER_TURN.BUYER;
      const canAccept = negotiating && !isBuyer && o.turn === LISTING_OFFER_TURN.SELLER;
      const canDecline = canAccept;
      const canWithdraw = negotiating && isBuyer && o.turn === LISTING_OFFER_TURN.BUYER;

      return {
        _id: String(o._id),
        listingId,
        listing: listingSummary(listingById.get(listingId)),
        amount: o.amount,
        status: o.status,
        turn: o.turn,
        maintainAmount: typeof maintainAmount === 'number' ? maintainAmount : undefined,
        sellerCounterLocked,
        listingPriceAtCreate: o.listingPriceAtCreate,
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : undefined,
        updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : undefined,
        yourRole: isBuyer ? 'buyer' : 'seller',
        buyer: userSummary(userById.get(buyerId)),
        seller: userSummary(userById.get(sellerId)),
        canCounter,
        canMaintain,
        canAccept,
        canDecline,
        canWithdraw,
      };
    });

    return NextResponse.json({ offers });
  } catch (e) {
    console.error(e);
    // Keep dashboard usable even if one malformed legacy row exists.
    return NextResponse.json({ offers: [] });
  }
}

