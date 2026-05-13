import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { SUBSCRIPTION_TIERS } from '@/lib/constants';

const bodySchema = z.object({
  tier: z.literal(SUBSCRIPTION_TIERS.FREE),
});

/**
 * Self-serve: switch account to the free listing tier (downgrade from paid tiers).
 */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Only switching to the free plan is supported here.' }, { status: 400 });
    }

    await dbConnect();
    const updated = await User.findByIdAndUpdate(
      session.user.id,
      { $set: { subscriptionTier: SUBSCRIPTION_TIERS.FREE } },
      { new: true }
    )
      .select('subscriptionTier')
      .lean();

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      subscriptionTier: (updated as { subscriptionTier?: string }).subscriptionTier ?? SUBSCRIPTION_TIERS.FREE,
    });
  } catch (e) {
    console.error('[me/subscription-tier]', e);
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}
