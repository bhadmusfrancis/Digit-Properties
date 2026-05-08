import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { USER_ROLES, WALLET_TX_REASONS } from '@/lib/constants';
import { creditWallet, debitWallet, getWalletBalance } from '@/lib/wallet';

/**
 * Admin credits or debits a user's Ad credit wallet.
 * Body: { amount: number (positive), action?: 'credit' | 'debit', description?: string }
 *
 * Negative amounts are treated as debits.
 */
export async function POST(
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
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const rawAmount = Number(body?.amount);
    const action = body?.action === 'debit' ? 'debit' : body?.action === 'credit' ? 'credit' : null;
    if (!Number.isFinite(rawAmount) || rawAmount === 0) {
      return NextResponse.json({ error: 'Amount required' }, { status: 400 });
    }

    const finalAction: 'credit' | 'debit' = action ?? (rawAmount < 0 ? 'debit' : 'credit');
    const amount = Math.abs(Math.floor(rawAmount));
    if (amount <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 });

    await dbConnect();
    const user = await User.findById(id).select('_id email').lean<{ _id: mongoose.Types.ObjectId; email?: string } | null>();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const description =
      typeof body?.description === 'string' && body.description.trim()
        ? body.description.trim().slice(0, 200)
        : undefined;

    if (finalAction === 'credit') {
      const result = await creditWallet(id, amount, {
        reason: WALLET_TX_REASONS.ADMIN_CREDIT,
        description: description ?? 'Admin credit',
        adminId: session.user.id,
      });
      return NextResponse.json({ success: true, action: 'credit', amount, balance: result.balanceAfter });
    }

    const result = await debitWallet(id, amount, {
      reason: WALLET_TX_REASONS.ADMIN_DEBIT,
      description: description ?? 'Admin debit',
      adminId: session.user.id,
    });
    if (!result.ok) {
      const balance = await getWalletBalance(id);
      return NextResponse.json(
        { error: `Insufficient balance (current: ${balance})` },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, action: 'debit', amount, balance: result.balanceAfter });
  } catch (e) {
    console.error('[admin/users/credit]', e);
    return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 });
  }
}

/** Read a user's current wallet balance. */
export async function GET(
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
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }
    await dbConnect();
    const balance = await getWalletBalance(id);
    return NextResponse.json({ balance, currency: 'NGN' });
  } catch (e) {
    console.error('[admin/users/credit GET]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
