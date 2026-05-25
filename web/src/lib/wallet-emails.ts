import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { WALLET_TX_REASONS } from '@/lib/constants';
import { sendWalletCreditEmail } from '@/lib/email';

type WalletCreditReason = (typeof WALLET_TX_REASONS)[keyof typeof WALLET_TX_REASONS];

const REASON_LABELS: Record<WalletCreditReason, string> = {
  [WALLET_TX_REASONS.TOPUP]: 'Wallet top-up',
  [WALLET_TX_REASONS.ADMIN_CREDIT]: 'Admin credit',
  [WALLET_TX_REASONS.COUPON_REDEMPTION]: 'Coupon redemption',
  [WALLET_TX_REASONS.BOOST_LISTING]: 'Listing boost refund',
  [WALLET_TX_REASONS.USER_AD]: 'Advert refund',
  [WALLET_TX_REASONS.SUBSCRIPTION_TIER]: 'Subscription credit',
  [WALLET_TX_REASONS.REFUND]: 'Refund',
  [WALLET_TX_REASONS.ADJUSTMENT]: 'Balance adjustment',
  [WALLET_TX_REASONS.ADMIN_DEBIT]: 'Admin debit',
};

function reasonLabel(reason: WalletCreditReason): string {
  return REASON_LABELS[reason] ?? 'Ad credit';
}

/**
 * Notify the user by email when their Ad credit wallet is credited.
 * Fire-and-forget; errors are logged and never thrown to callers.
 */
export async function notifyWalletCredit(
  userId: string | mongoose.Types.ObjectId,
  amount: number,
  reason: WalletCreditReason,
  balanceAfter: number,
  description?: string
): Promise<void> {
  try {
    await dbConnect();
    const uid =
      userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(String(userId));
    const user = await User.findById(uid).select('email name').lean<{ email?: string; name?: string } | null>();
    if (!user?.email) return;

    await sendWalletCreditEmail({
      to: user.email,
      name: user.name || 'there',
      amount,
      balanceAfter,
      reasonLabel: reasonLabel(reason),
      description,
    });
  } catch (e) {
    console.error('[wallet-emails] notifyWalletCredit failed:', e);
  }
}
