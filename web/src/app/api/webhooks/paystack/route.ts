import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbConnect } from '@/lib/db';
import Payment from '@/models/Payment';
import Listing from '@/models/Listing';
import User from '@/models/User';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');

    const sig = req.headers.get('x-paystack-signature');
    if (hash !== sig) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    if (event.event !== 'charge.success') {
      return NextResponse.json({ received: true });
    }

    const ref = event.data?.reference;
    if (!ref) return NextResponse.json({ received: true });

    await dbConnect();
    let payment = await Payment.findOne({ gatewayRef: ref });

    if (!payment) {
      const meta = (event.data?.metadata || {}) as Record<string, string | undefined>;
      if (meta.purpose === 'subscription_tier' && meta.userId && (meta.tier === 'gold' || meta.tier === 'premium')) {
        const amountKobo = event.data?.amount;
        const amount = typeof amountKobo === 'number' ? Math.round(amountKobo / 100) : 10000;
        const mongoose = await import('mongoose');
        payment = await Payment.create({
          userId: new mongoose.Types.ObjectId(meta.userId),
          amount,
          currency: 'NGN',
          gateway: 'paystack',
          gatewayRef: ref,
          purpose: 'subscription_tier',
          status: 'success',
          metadata: { tier: meta.tier },
        });
      } else {
        return NextResponse.json({ received: true });
      }
    } else if (payment.status === 'success') {
      return NextResponse.json({ received: true }); // idempotency
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

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
