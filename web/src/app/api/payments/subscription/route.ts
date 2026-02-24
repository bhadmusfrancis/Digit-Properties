import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Payment from '@/models/Payment';
import User from '@/models/User';
import { USER_ROLES, SUBSCRIPTION_TIERS, PAYMENT_PURPOSE, DEFAULT_SUBSCRIPTION_LIMITS } from '@/lib/constants';
import crypto from 'crypto';

const ALLOWED_TIERS = [SUBSCRIPTION_TIERS.GOLD, SUBSCRIPTION_TIERS.PREMIUM] as const;

function generateRef() {
  return `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { tier, gateway } = body as { tier?: string; gateway?: 'paystack' | 'flutterwave' | 'test' };

    if (!tier || !ALLOWED_TIERS.includes(tier as (typeof ALLOWED_TIERS)[number])) {
      return NextResponse.json({ error: 'Invalid tier. Use gold or premium.' }, { status: 400 });
    }

    const def = DEFAULT_SUBSCRIPTION_LIMITS[tier];
    const amount = def?.priceMonthly ?? (tier === SUBSCRIPTION_TIERS.GOLD ? 10000 : 30000);

    const isAdmin = session.user.role === USER_ROLES.ADMIN;
    if (gateway === 'test' && isAdmin) {
      await dbConnect();
      await User.findByIdAndUpdate(session.user.id, { subscriptionTier: tier });
      return NextResponse.json({
        test: true,
        subscriptionTier: tier,
        message: `Subscription set to ${tier} (test).`,
      });
    }

    if (!gateway || (gateway !== 'paystack' && gateway !== 'flutterwave')) {
      return NextResponse.json(
        { error: 'Choose Paystack or Flutterwave. Admins can use gateway: "test" for a free test upgrade.' },
        { status: 400 }
      );
    }

    if (!session.user.email?.trim()) {
      return NextResponse.json({ error: 'Your account needs an email to pay. Add one in Profile.' }, { status: 400 });
    }

    const ref = generateRef();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/dashboard/payments/upgrade?success=true`;

    let dbOk = false;
    try {
      await dbConnect();
      await Payment.create({
        userId: session.user.id,
        amount,
        currency: 'NGN',
        gateway,
        gatewayRef: ref,
        purpose: PAYMENT_PURPOSE.SUBSCRIPTION_TIER,
        status: 'pending',
        metadata: { tier },
      });
      dbOk = true;
    } catch (dbErr) {
      console.warn('[payments/subscription] DB unavailable, proceeding to gateway only. Webhook will create record.', dbErr);
    }

    if (gateway === 'paystack') {
      if (!process.env.PAYSTACK_SECRET_KEY) {
        return NextResponse.json({ error: 'Paystack is not configured' }, { status: 503 });
      }
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
          metadata: { userId: session.user.id, purpose: PAYMENT_PURPOSE.SUBSCRIPTION_TIER, tier },
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
        dbOffline: !dbOk,
      });
    }

    if (gateway === 'flutterwave') {
      if (!process.env.FLUTTERWAVE_SECRET_KEY || !process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY) {
        return NextResponse.json({ error: 'Flutterwave is not configured' }, { status: 503 });
      }
      const Flutterwave = (await import('flutterwave-node-v3')).default;
      const flw = new Flutterwave(
        process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY,
        process.env.FLUTTERWAVE_SECRET_KEY
      );
      const flwRes = await flw.PaymentLink.initiate({
        tx_ref: ref,
        amount,
        currency: 'NGN',
        redirect_url: callbackUrl,
        customer: {
          email: session.user.email!,
          name: session.user.name!,
        },
        customizations: { title: `Subscription ${tier} - Digit Properties` },
        meta: { userId: session.user.id, purpose: PAYMENT_PURPOSE.SUBSCRIPTION_TIER, tier },
      });
      return NextResponse.json({
        link: flwRes.data?.link,
        reference: ref,
        dbOffline: !dbOk,
      });
    }

    return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 });
  } catch (e) {
    console.error('[payments/subscription]', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message || 'Failed to start subscription payment' },
      { status: 500 }
    );
  }
}
