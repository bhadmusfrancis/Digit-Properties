import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbConnect } from '@/lib/db';
import Payment from '@/models/Payment';
import Listing from '@/models/Listing';

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
    const payment = await Payment.findOne({ gatewayRef: ref });
    if (!payment) return NextResponse.json({ received: true });
    if (payment.status === 'success') return NextResponse.json({ received: true }); // idempotency

    payment.status = 'success';
    await payment.save();

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

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
