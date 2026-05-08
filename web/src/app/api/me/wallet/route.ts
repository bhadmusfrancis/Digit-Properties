import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import WalletTransaction from '@/models/WalletTransaction';
import { getOrCreateWallet } from '@/lib/wallet';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const wallet = await getOrCreateWallet(session.user.id);

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '25', 10)));

    const transactions = await WalletTransaction.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      balance: wallet.balance,
      currency: wallet.currency,
      transactions,
    });
  } catch (e) {
    console.error('[me/wallet GET]', e);
    return NextResponse.json({ error: 'Failed to load wallet' }, { status: 500 });
  }
}
