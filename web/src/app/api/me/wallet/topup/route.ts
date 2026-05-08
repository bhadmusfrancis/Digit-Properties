import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Payment from '@/models/Payment';
import { PAYMENT_PURPOSE, WALLET_TOPUP_LIMITS } from '@/lib/constants';

function generateRef() {
  return `wallet_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Initiate a Paystack top-up of the user's Ad credit wallet.
 * Body: { amount: number (NGN) }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.user.email) {
      return NextResponse.json(
        { error: 'Your account needs an email to top up. Add one in Profile.' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const amount = Math.floor(Number(body?.amount));
    if (!Number.isFinite(amount) || amount < WALLET_TOPUP_LIMITS.MIN || amount > WALLET_TOPUP_LIMITS.MAX) {
      return NextResponse.json(
        { error: `Amount must be between ₦${WALLET_TOPUP_LIMITS.MIN.toLocaleString()} and ₦${WALLET_TOPUP_LIMITS.MAX.toLocaleString()}.` },
        { status: 400 }
      );
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: 'Paystack is not configured' }, { status: 503 });
    }

    await dbConnect();
    const ref = generateRef();
    const idempotencyKey = `wallet_topup_${session.user.id}_${ref}`;

    await Payment.create({
      userId: session.user.id,
      amount,
      currency: 'NGN',
      gateway: 'paystack',
      gatewayRef: ref,
      purpose: PAYMENT_PURPOSE.WALLET_TOPUP,
      status: 'pending',
      idempotencyKey,
      metadata: {},
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/dashboard/wallet?topup=success`;

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
        metadata: {
          userId: session.user.id,
          purpose: PAYMENT_PURPOSE.WALLET_TOPUP,
        },
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
  } catch (e) {
    console.error('[me/wallet/topup]', e);
    return NextResponse.json({ error: 'Failed to start top-up' }, { status: 500 });
  }
}
