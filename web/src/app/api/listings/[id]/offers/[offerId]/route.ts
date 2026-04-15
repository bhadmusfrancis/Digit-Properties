import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import ListingProfessionalOffer from '@/models/ListingProfessionalOffer';
import { canViewListingOnSite } from '@/lib/listing-access';
import { listingOfferPatchSchema } from '@/lib/validations';
import { LISTING_OFFER_STATUS, LISTING_OFFER_TURN } from '@/models/ListingProfessionalOffer';
import { USER_PUBLIC_BADGE_FIELDS, shapePublicCreatedBy } from '@/lib/verification';
import User from '@/models/User';
import {
  sendProfessionalOfferAcceptedEmail,
  sendProfessionalOfferCounterEmail,
  sendProfessionalOfferDeclinedEmail,
  sendProfessionalOfferWithdrawnEmail,
} from '@/lib/email';

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { id: listingId, offerId } = await params;
    if (!mongoose.Types.ObjectId.isValid(listingId) || !mongoose.Types.ObjectId.isValid(offerId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = listingOfferPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const action = parsed.data;

    await dbConnect();
    const listing = await Listing.findById(listingId).select('status createdBy title').lean();
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (
      !canViewListingOnSite({
        status: listing.status,
        createdBy: listing.createdBy,
        session,
      })
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const offer = await ListingProfessionalOffer.findOne({
      _id: new mongoose.Types.ObjectId(offerId),
      listingId: new mongoose.Types.ObjectId(listingId),
    });
    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });

    const uid = session.user.id;
    const isSeller = String(offer.sellerId) === uid;
    const isBuyer = String(offer.buyerId) === uid;
    if (!isSeller && !isBuyer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (offer.status !== LISTING_OFFER_STATUS.NEGOTIATING) {
      return NextResponse.json({ error: 'This offer is no longer open for changes' }, { status: 409 });
    }

    const [buyerUser, sellerUser] = await Promise.all([
      User.findById(offer.buyerId).select('name email').lean(),
      User.findById(offer.sellerId).select('name email').lean(),
    ]);
    const buyerEmail = typeof buyerUser?.email === 'string' ? buyerUser.email : '';
    const sellerEmail = typeof sellerUser?.email === 'string' ? sellerUser.email : '';
    const buyerName = (typeof buyerUser?.name === 'string' && buyerUser.name) || 'Buyer';
    const sellerName = (typeof sellerUser?.name === 'string' && sellerUser.name) || 'Seller';
    const listingTitle = (listing as { title?: string }).title || 'Listing';
    const latestAmount = offer.amount;

    if (action.action === 'withdraw') {
      if (!isBuyer) {
        return NextResponse.json({ error: 'Only the buyer can withdraw an offer' }, { status: 403 });
      }
      offer.status = LISTING_OFFER_STATUS.WITHDRAWN;
      offer.events.push({
        actorId: new mongoose.Types.ObjectId(uid),
        kind: 'withdrawn',
      });
      await offer.save();
      const lean = await ListingProfessionalOffer.findById(offer._id).populate('buyerId', USER_PUBLIC_BADGE_FIELDS).lean();
      if (sellerEmail) {
        sendProfessionalOfferWithdrawnEmail({
          to: sellerEmail,
          recipientName: sellerName,
          buyerName,
          listingTitle,
          listingId,
          offerAmount: latestAmount,
        }).catch((e) => console.error('[offers] withdrawn email:', e));
      }
      return NextResponse.json({ offer: lean ? serializeOffer(lean as Parameters<typeof serializeOffer>[0]) : null });
    }

    if (isSeller && (action.action === 'accept' || action.action === 'decline' || action.action === 'counter')) {
      if (offer.turn !== LISTING_OFFER_TURN.SELLER) {
        return NextResponse.json({ error: 'It is not your turn to respond on this offer' }, { status: 409 });
      }

      if (action.action === 'accept') {
        offer.status = LISTING_OFFER_STATUS.ACCEPTED;
        offer.events.push({
          actorId: new mongoose.Types.ObjectId(uid),
          kind: 'accepted',
          amount: offer.amount,
        });
        await offer.save();
        const lean = await ListingProfessionalOffer.findById(offer._id).populate('buyerId', USER_PUBLIC_BADGE_FIELDS).lean();
        if (buyerEmail) {
          sendProfessionalOfferAcceptedEmail({
            to: buyerEmail,
            recipientName: buyerName,
            listingTitle,
            listingId,
            offerAmount: offer.amount,
          }).catch((e) => console.error('[offers] accepted email:', e));
        }
        return NextResponse.json({ offer: lean ? serializeOffer(lean as Parameters<typeof serializeOffer>[0]) : null });
      }

      if (action.action === 'decline') {
        offer.status = LISTING_OFFER_STATUS.DECLINED;
        offer.events.push({
          actorId: new mongoose.Types.ObjectId(uid),
          kind: 'declined',
          amount: offer.amount,
        });
        await offer.save();
        const lean = await ListingProfessionalOffer.findById(offer._id).populate('buyerId', USER_PUBLIC_BADGE_FIELDS).lean();
        if (buyerEmail) {
          sendProfessionalOfferDeclinedEmail({
            to: buyerEmail,
            recipientName: buyerName,
            listingTitle,
            listingId,
            offerAmount: offer.amount,
          }).catch((e) => console.error('[offers] declined email:', e));
        }
        return NextResponse.json({ offer: lean ? serializeOffer(lean as Parameters<typeof serializeOffer>[0]) : null });
      }

      offer.amount = action.amount;
      offer.turn = LISTING_OFFER_TURN.BUYER;
      offer.events.push({
        actorId: new mongoose.Types.ObjectId(uid),
        kind: 'counter',
        amount: action.amount,
        message: action.message?.trim() || undefined,
      });
      await offer.save();
      const lean = await ListingProfessionalOffer.findById(offer._id).populate('buyerId', USER_PUBLIC_BADGE_FIELDS).lean();
      if (buyerEmail) {
        sendProfessionalOfferCounterEmail({
          to: buyerEmail,
          recipientName: buyerName,
          actorName: sellerName,
          listingTitle,
          listingId,
          offerAmount: action.amount,
        }).catch((e) => console.error('[offers] seller counter email:', e));
      }
      return NextResponse.json({ offer: lean ? serializeOffer(lean as Parameters<typeof serializeOffer>[0]) : null });
    }

    if (isBuyer && action.action === 'counter') {
      if (offer.turn !== LISTING_OFFER_TURN.BUYER) {
        return NextResponse.json({ error: 'It is not your turn to counter on this offer' }, { status: 409 });
      }
      offer.amount = action.amount;
      offer.turn = LISTING_OFFER_TURN.SELLER;
      offer.events.push({
        actorId: new mongoose.Types.ObjectId(uid),
        kind: 'counter',
        amount: action.amount,
        message: action.message?.trim() || undefined,
      });
      await offer.save();
      const lean = await ListingProfessionalOffer.findById(offer._id).populate('buyerId', USER_PUBLIC_BADGE_FIELDS).lean();
      if (sellerEmail) {
        sendProfessionalOfferCounterEmail({
          to: sellerEmail,
          recipientName: sellerName,
          actorName: buyerName,
          listingTitle,
          listingId,
          offerAmount: action.amount,
        }).catch((e) => console.error('[offers] buyer counter email:', e));
      }
      return NextResponse.json({ offer: lean ? serializeOffer(lean as Parameters<typeof serializeOffer>[0]) : null });
    }

    return NextResponse.json({ error: 'Invalid action for your role' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update offer' }, { status: 500 });
  }
}
