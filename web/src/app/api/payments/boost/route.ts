import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import Payment from '@/models/Payment';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { BOOST_PACKAGES } from '@/lib/boost-packages';
import { debitWallet, getWalletBalance } from '@/lib/wallet';
import { PAYMENT_PURPOSE, WALLET_TX_REASONS } from '@/lib/constants';

type BoostPackageId = keyof typeof BOOST_PACKAGES;

function generateRef() {
  return `boost_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { listingId, gateway, packageId } = body as {
      listingId?: string;
      gateway?: 'paystack' | 'flutterwave' | 'wallet';
      packageId?: BoostPackageId;
    };

    if (!listingId || !gateway) {
      return NextResponse.json({ error: 'listingId and gateway required' }, { status: 400 });
    }
    const selectedPackage = BOOST_PACKAGES[(packageId ?? 'starter') as BoostPackageId];
    if (!selectedPackage) {
      return NextResponse.json({ error: 'Invalid boost package' }, { status: 400 });
    }
    if (gateway !== 'paystack' && gateway !== 'wallet') {
      return NextResponse.json({ error: 'Pay with Paystack or your Ad credit wallet.' }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.findById(listingId);
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    if (listing.createdBy.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Not your listing' }, { status: 403 });
    }

    const ref = generateRef();
    const idempotencyKey = `boost_${listingId}_${session.user.id}_${Date.now()}`;
    const amount = selectedPackage.amount;
    const days = selectedPackage.days;

    if (gateway === 'wallet') {
      const balance = await getWalletBalance(session.user.id);
      if (balance < amount) {
        return NextResponse.json(
          { error: `Insufficient Ad credit. Balance ₦${balance.toLocaleString()}, needs ₦${amount.toLocaleString()}.` },
          { status: 400 }
        );
      }

      const payment = await Payment.create({
        userId: session.user.id,
        amount,
        currency: 'NGN',
        gateway: 'wallet',
        gatewayRef: ref,
        purpose: PAYMENT_PURPOSE.BOOST_LISTING,
        listingId,
        status: 'success',
        idempotencyKey,
        metadata: { boostDays: days, boostPackage: packageId ?? 'starter' },
      });

      const debit = await debitWallet(session.user.id, amount, {
        reason: WALLET_TX_REASONS.BOOST_LISTING,
        listingId,
        paymentId: payment._id,
        description: `Boost ${selectedPackage.name} (${days} days)`,
      });
      if (!debit.ok) {
        await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
        return NextResponse.json({ error: 'Insufficient Ad credit (race).' }, { status: 400 });
      }

      const now = new Date();
      const currentEnd = listing.boostExpiresAt ? new Date(listing.boostExpiresAt) : null;
      const base = currentEnd && currentEnd > now ? currentEnd : now;
      const newExpiry = new Date(base);
      newExpiry.setDate(newExpiry.getDate() + days);
      await Listing.findByIdAndUpdate(listingId, {
        boostPackage: packageId ?? 'starter',
        boostExpiresAt: newExpiry,
        featured: selectedPackage.featured,
        highlighted: selectedPackage.highlighted,
      });

      return NextResponse.json({
        paidWithWallet: true,
        balance: debit.balanceAfter,
        boostExpiresAt: newExpiry.toISOString(),
        reference: ref,
      });
    }

    await Payment.create({
      userId: session.user.id,
      amount,
      currency: 'NGN',
      gateway,
      gatewayRef: ref,
      purpose: PAYMENT_PURPOSE.BOOST_LISTING,
      listingId,
      status: 'pending',
      idempotencyKey,
      metadata: { boostDays: days, boostPackage: packageId ?? 'starter' },
    });

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: 'Paystack is not configured' }, { status: 503 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: session.user.email,
        amount: amount * 100,
        reference: ref,
        metadata: { listingId, userId: session.user.id, purpose: 'boost_listing', boostPackage: packageId ?? 'starter' },
        callback_url: `${baseUrl}/dashboard/boost?success=true`,
      }),
    });
    const data = await res.json();
    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Paystack error' }, { status: 400 });
    }
    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: ref,
      publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: session.user.email,
      amount,
      boostPackage: packageId ?? 'starter',
      boostDays: days,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to initiate boost payment' }, { status: 500 });
  }
}
