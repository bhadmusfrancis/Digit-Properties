import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import { redeemCoupon } from '@/lib/wallet';

const ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Invalid coupon code.',
  inactive: 'This coupon is no longer active.',
  expired: 'This coupon has expired.',
  exhausted: 'This coupon has reached its redemption limit.',
  already_redeemed: 'You have already used this coupon.',
};

/** Redeem a coupon code and credit the user's wallet. Body: { code: string } */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || '').trim();
    if (!code) return NextResponse.json({ error: 'Coupon code required' }, { status: 400 });

    await dbConnect();
    const result = await redeemCoupon(session.user.id, code);
    if (!result.ok) {
      return NextResponse.json(
        { error: ERROR_MESSAGES[result.error] || 'Could not redeem coupon.' },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      amountCredited: result.amount,
      balance: result.balanceAfter,
    });
  } catch (e) {
    console.error('[me/wallet/coupon]', e);
    return NextResponse.json({ error: 'Failed to redeem coupon' }, { status: 500 });
  }
}
