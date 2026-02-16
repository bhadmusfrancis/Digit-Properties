import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Payment from '@/models/Payment';
import Listing from '@/models/Listing';

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

    const txRef = event.data?.tx_ref;
    if (!txRef) return NextResponse.json({ status: 'success' });

    await dbConnect();
    const payment = await Payment.findOne({ gatewayRef: txRef });
    if (!payment) return NextResponse.json({ status: 'success' });
    if (payment.status === 'success') return NextResponse.json({ status: 'success' });

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

    return NextResponse.json({ status: 'success' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
