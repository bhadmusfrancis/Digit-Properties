import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Payment from '@/models/Payment';
import Listing from '@/models/Listing';
import User from '@/models/User';

function verifyWebhook(secret: string): boolean {
  return !!process.env.FLUTTERWAVE_WEBHOOK_SECRET && secret === process.env.FLUTTERWAVE_WEBHOOK_SECRET;
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const sig = req.headers.get('verif-hash') || '';
    if (!verifyWebhook(sig)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    if (event.event !== 'charge.completed') {
      return NextResponse.json({ status: 'success' });
    }

    const txRef = event.data?.tx_ref || event.data?.reference;
    if (!txRef) return NextResponse.json({ status: 'success' });

    await dbConnect();
    let payment = await Payment.findOne({ gatewayRef: txRef });

    if (!payment) {
      const meta = (event.data?.meta || event.data?.customer?.meta || {}) as Record<string, string | undefined>;
      if (meta.purpose === 'subscription_tier' && meta.userId && (meta.tier === 'gold' || meta.tier === 'premium')) {
        const amount = event.data?.amount ?? 10000;
        const mongoose = await import('mongoose');
        payment = await Payment.create({
          userId: new mongoose.Types.ObjectId(meta.userId),
          amount: typeof amount === 'number' ? amount : 10000,
          currency: 'NGN',
          gateway: 'flutterwave',
          gatewayRef: txRef,
          purpose: 'subscription_tier',
          status: 'success',
          metadata: { tier: meta.tier },
        });
      } else {
        return NextResponse.json({ status: 'success' });
      }
    } else if (payment.status === 'success') {
      return NextResponse.json({ status: 'success' });
    } else {
      payment.status = 'success';
      await payment.save();
    }

    if (payment.purpose === 'boost_listing' && payment.listingId) {
      const days = (payment.metadata as { boostDays?: number })?.boostDays || 7;
      const listing = await Listing.findById(payment.listingId).select('boostExpiresAt').lean();
      const now = new Date();
      const currentEnd = listing?.boostExpiresAt ? new Date(listing.boostExpiresAt) : null;
      const base = currentEnd && currentEnd > now ? currentEnd : now;
      const newExpiry = new Date(base);
      newExpiry.setDate(newExpiry.getDate() + days);
      await Listing.findByIdAndUpdate(payment.listingId, { boostExpiresAt: newExpiry });
    }

    if (payment.purpose === 'subscription_tier' && payment.userId) {
      const tier = (payment.metadata as { tier?: string })?.tier;
      if (tier === 'gold' || tier === 'premium') {
        await User.findByIdAndUpdate(payment.userId, { subscriptionTier: tier });
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
