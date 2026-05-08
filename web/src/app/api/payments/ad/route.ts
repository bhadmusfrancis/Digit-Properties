import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import UserAd from '@/models/UserAd';
import Payment from '@/models/Payment';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { debitWallet, getWalletBalance } from '@/lib/wallet';
import { PAYMENT_PURPOSE, WALLET_TX_REASONS } from '@/lib/constants';

function generateRef() {
  return `ad_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { adId, gateway } = body as { adId?: string; gateway?: 'paystack' | 'flutterwave' | 'wallet' };

    if (!adId || !gateway) {
      return NextResponse.json({ error: 'adId and gateway required' }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return NextResponse.json({ error: 'Invalid ad ID' }, { status: 400 });
    }

    await dbConnect();
    const ad = await UserAd.findById(adId);
    if (!ad) return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    if (ad.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Not your ad' }, { status: 403 });
    }
    if (ad.paymentId) {
      return NextResponse.json({ error: 'Ad already paid' }, { status: 400 });
    }
    if (ad.status !== 'pending_approval') {
      return NextResponse.json({ error: 'Ad cannot be paid in current state' }, { status: 400 });
    }

    const amount = ad.amountPaid ?? 0;
    if (amount <= 0) {
      return NextResponse.json({ error: 'Ad has no amount set; recreate the ad' }, { status: 400 });
    }

    const ref = generateRef();
    const idempotencyKey = `ad_${adId}_${session.user.id}_${Date.now()}`;

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
        purpose: PAYMENT_PURPOSE.USER_AD,
        status: 'success',
        idempotencyKey,
        metadata: { adId },
      });
      const debit = await debitWallet(session.user.id, amount, {
        reason: WALLET_TX_REASONS.USER_AD,
        adId,
        paymentId: payment._id,
        description: `Advert ${ad.placement}`,
      });
      if (!debit.ok) {
        await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
        return NextResponse.json({ error: 'Insufficient Ad credit (race).' }, { status: 400 });
      }
      await UserAd.findByIdAndUpdate(adId, { paymentId: payment._id });
      return NextResponse.json({
        paidWithWallet: true,
        balance: debit.balanceAfter,
        reference: ref,
      });
    }

    await Payment.create({
      userId: session.user.id,
      amount,
      currency: 'NGN',
      gateway,
      gatewayRef: ref,
      purpose: PAYMENT_PURPOSE.USER_AD,
      status: 'pending',
      idempotencyKey,
      metadata: { adId },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/dashboard/ads?success=true`;

    if (gateway === 'paystack') {
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
          metadata: { adId, userId: session.user.id, purpose: 'user_ad' },
          callback_url: callbackUrl,
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

    if (gateway === 'flutterwave') {
      if (!process.env.FLUTTERWAVE_SECRET_KEY) {
        return NextResponse.json({ error: 'Flutterwave is not configured' }, { status: 503 });
      }
      const response = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: ref,
          amount,
          currency: 'NGN',
          redirect_url: callbackUrl,
          customer: {
            email: session.user.email,
            name: session.user.name || session.user.email,
          },
          customizations: { title: 'Advert - Digit Properties' },
          meta: { adId, userId: session.user.id, purpose: 'user_ad' },
        }),
      });
      const data = await response.json();
      const link = data?.data?.link as string | undefined;
      if (!response.ok || !link) {
        return NextResponse.json({ error: data?.message || 'Flutterwave error' }, { status: 400 });
      }
      return NextResponse.json({
        link,
        reference: ref,
      });
    }

    return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to initiate ad payment' }, { status: 500 });
  }
}
