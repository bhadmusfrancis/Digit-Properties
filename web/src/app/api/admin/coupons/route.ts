import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import CouponCode from '@/models/CouponCode';
import { USER_ROLES } from '@/lib/constants';

function generateCode(len = 10): string {
  // Avoid ambiguous chars (0/O, 1/I/L).
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** List coupons (most recent first). */
export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await dbConnect();
  const coupons = await CouponCode.find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .select('code amount maxRedemptions redeemedCount expiresAt active description createdAt')
    .lean();
  return NextResponse.json(coupons);
}

/**
 * Create a coupon.
 * Body: { code?: string, amount: number, maxRedemptions: number, expiresAt?: ISO string, description?: string }
 * If `code` is omitted, a random 10-char code is generated.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));

    const amount = Math.floor(Number(body?.amount));
    const maxRedemptions = Math.floor(Number(body?.maxRedemptions));
    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }
    if (!Number.isFinite(maxRedemptions) || maxRedemptions < 1) {
      return NextResponse.json({ error: 'maxRedemptions must be >= 1' }, { status: 400 });
    }

    let code = (typeof body?.code === 'string' ? body.code : '').trim().toUpperCase();
    if (code) {
      if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
        return NextResponse.json(
          { error: 'Code must be 4-32 chars, A-Z / 0-9 / _ / -' },
          { status: 400 }
        );
      }
    } else {
      code = generateCode(10);
    }

    let expiresAt: Date | undefined;
    if (body?.expiresAt) {
      const d = new Date(body.expiresAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Invalid expiresAt' }, { status: 400 });
      }
      expiresAt = d;
    }

    const description =
      typeof body?.description === 'string' && body.description.trim()
        ? body.description.trim().slice(0, 200)
        : undefined;

    await dbConnect();
    const exists = await CouponCode.findOne({ code }).select('_id').lean();
    if (exists) return NextResponse.json({ error: 'Code already exists' }, { status: 400 });

    const coupon = await CouponCode.create({
      code,
      amount,
      maxRedemptions,
      expiresAt,
      description,
      active: true,
      createdBy: session.user.id,
    });

    return NextResponse.json({
      _id: coupon._id,
      code: coupon.code,
      amount: coupon.amount,
      maxRedemptions: coupon.maxRedemptions,
      redeemedCount: coupon.redeemedCount,
      expiresAt: coupon.expiresAt,
      active: coupon.active,
      description: coupon.description,
      createdAt: coupon.createdAt,
    });
  } catch (e) {
    console.error('[admin/coupons POST]', e);
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 });
  }
}
