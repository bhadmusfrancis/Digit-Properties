import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import CouponCode from '@/models/CouponCode';
import { USER_ROLES } from '@/lib/constants';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  await dbConnect();
  const coupon = await CouponCode.findById(id)
    .populate({ path: 'redemptions.userId', select: 'name email', model: 'User' })
    .lean();
  if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(coupon);
}

/** Update coupon: { active?, maxRedemptions?, expiresAt?, description? } */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const update: Record<string, unknown> = {};
    if (typeof body?.active === 'boolean') update.active = body.active;
    if (body?.maxRedemptions !== undefined) {
      const n = Math.floor(Number(body.maxRedemptions));
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json({ error: 'maxRedemptions must be >= 1' }, { status: 400 });
      }
      update.maxRedemptions = n;
    }
    if (body?.expiresAt !== undefined) {
      if (body.expiresAt === null || body.expiresAt === '') {
        update.expiresAt = null;
      } else {
        const d = new Date(body.expiresAt);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: 'Invalid expiresAt' }, { status: 400 });
        }
        update.expiresAt = d;
      }
    }
    if (typeof body?.description === 'string') {
      update.description = body.description.trim().slice(0, 200) || undefined;
    }

    await dbConnect();
    const coupon = await CouponCode.findByIdAndUpdate(id, { $set: update }, { new: true })
      .select('code amount maxRedemptions redeemedCount expiresAt active description')
      .lean();
    if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(coupon);
  } catch (e) {
    console.error('[admin/coupons PATCH]', e);
    return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    await dbConnect();
    const coupon = await CouponCode.findByIdAndDelete(id);
    if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[admin/coupons DELETE]', e);
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 });
  }
}
