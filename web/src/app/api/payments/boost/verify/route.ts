import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Payment from '@/models/Payment';
import Listing from '@/models/Listing';
import { BOOST_PACKAGES } from '@/lib/boost-packages';
import { PAYMENT_PURPOSE } from '@/lib/constants';

/**
 * Server-side verification of a Paystack boost transaction triggered by the
 * inline checkout. Safe to call multiple times (idempotent on Payment.status).
 *
 * Body: { reference: string }
 * Returns the updated boost state on the listing on success.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const reference = String(body?.reference || '').trim();
    if (!reference) {
      return NextResponse.json({ error: 'reference required' }, { status: 400 });
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: 'Paystack is not configured' }, { status: 503 });
    }

    await dbConnect();
    const payment = await Payment.findOne({ gatewayRef: reference });
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    if (payment.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (payment.purpose !== PAYMENT_PURPOSE.BOOST_LISTING) {
      return NextResponse.json({ error: 'Not a boost payment' }, { status: 400 });
    }

    // Already settled — return current listing boost state.
    const listingIdString = payment.listingId?.toString();
    const replyWithListing = async () => {
      const listing = listingIdString
        ? await Listing.findById(listingIdString).select('boostPackage boostExpiresAt featured highlighted').lean()
        : null;
      return NextResponse.json({
        ok: true,
        status: payment.status,
        reference,
        listingId: listingIdString,
        listing,
      });
    };

    if (payment.status === 'success') return replyWithListing();

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson?.status || verifyJson?.data?.status !== 'success') {
      return NextResponse.json(
        { ok: false, status: payment.status, error: verifyJson?.message || 'Payment not successful' },
        { status: 400 }
      );
    }

    payment.status = 'success';
    await payment.save();

    if (listingIdString) {
      const meta = (payment.metadata ?? {}) as { boostDays?: number; boostPackage?: keyof typeof BOOST_PACKAGES };
      const days = meta.boostDays || 7;
      const packageId = meta.boostPackage ?? 'starter';
      const boostPackage = BOOST_PACKAGES[packageId] ?? BOOST_PACKAGES.starter;
      const listing = await Listing.findById(listingIdString).select('boostExpiresAt').lean();
      const now = new Date();
      const currentEnd = listing?.boostExpiresAt ? new Date(listing.boostExpiresAt) : null;
      const base = currentEnd && currentEnd > now ? currentEnd : now;
      const newExpiry = new Date(base);
      newExpiry.setDate(newExpiry.getDate() + days);
      await Listing.findByIdAndUpdate(listingIdString, {
        boostPackage: packageId,
        boostExpiresAt: newExpiry,
        featured: boostPackage.featured,
        highlighted: boostPackage.highlighted,
      });
    }

    return replyWithListing();
  } catch (e) {
    console.error('[payments/boost/verify]', e);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
