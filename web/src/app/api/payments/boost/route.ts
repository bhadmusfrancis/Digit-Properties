import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import Payment from '@/models/Payment';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { BOOST_PACKAGES } from '@/lib/boost-packages';
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
      gateway?: 'paystack' | 'flutterwave';
      packageId?: BoostPackageId;
    };

    if (!listingId || !gateway) {
      return NextResponse.json({ error: 'listingId and gateway required' }, { status: 400 });
    }
    const selectedPackage = BOOST_PACKAGES[(packageId ?? 'starter') as BoostPackageId];
    if (!selectedPackage) {
      return NextResponse.json({ error: 'Invalid boost package' }, { status: 400 });
    }
    if (gateway !== 'paystack') {
      return NextResponse.json({ error: 'Only Paystack is available for boost payments right now.' }, { status: 400 });
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

    await Payment.create({
      userId: session.user.id,
      amount: selectedPackage.amount,
      currency: 'NGN',
      gateway,
      gatewayRef: ref,
      purpose: 'boost_listing',
      listingId,
      status: 'pending',
      idempotencyKey,
      metadata: { boostDays: selectedPackage.days, boostPackage: packageId ?? 'starter' },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (gateway === 'paystack') {
      const res = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session.user.email,
          amount: selectedPackage.amount * 100, // kobo
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
        reference: ref,
      });
    }

    return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to initiate boost payment' }, { status: 500 });
  }
}
