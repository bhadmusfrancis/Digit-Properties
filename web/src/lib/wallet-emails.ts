import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import Listing from '@/models/Listing';
import { WALLET_TX_REASONS, WALLET_TX_TYPES } from '@/lib/constants';
import { buildListingEmailUrl } from '@/lib/listing-email-link';
import { sendWalletActivityEmail } from '@/lib/email';

type WalletReason = (typeof WALLET_TX_REASONS)[keyof typeof WALLET_TX_REASONS];
type WalletDirection = (typeof WALLET_TX_TYPES)[keyof typeof WALLET_TX_TYPES];

const CREDIT_LABELS: Record<WalletReason, string> = {
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

const DEBIT_LABELS: Record<WalletReason, string> = {
  [WALLET_TX_REASONS.TOPUP]: 'Wallet top-up reversal',
  [WALLET_TX_REASONS.ADMIN_CREDIT]: 'Admin credit reversal',
  [WALLET_TX_REASONS.COUPON_REDEMPTION]: 'Coupon reversal',
  [WALLET_TX_REASONS.BOOST_LISTING]: 'Listing boost',
  [WALLET_TX_REASONS.USER_AD]: 'Advert placement',
  [WALLET_TX_REASONS.SUBSCRIPTION_TIER]: 'Subscription',
  [WALLET_TX_REASONS.REFUND]: 'Refund reversal',
  [WALLET_TX_REASONS.ADJUSTMENT]: 'Balance adjustment',
  [WALLET_TX_REASONS.ADMIN_DEBIT]: 'Admin debit',
};

function reasonLabel(reason: WalletReason, direction: WalletDirection): string {
  const map = direction === WALLET_TX_TYPES.CREDIT ? CREDIT_LABELS : DEBIT_LABELS;
  return map[reason] ?? (direction === WALLET_TX_TYPES.CREDIT ? 'Ad credit added' : 'Ad credit spent');
}

async function resolveListingEmailUrl(
  listingId: string | mongoose.Types.ObjectId | undefined
): Promise<string | undefined> {
  if (!listingId) return undefined;
  const id = String(listingId);
  const listing = await Listing.findById(id).select('slug').lean<{ slug?: string } | null>();
  return buildListingEmailUrl({ id, slug: listing?.slug });
}

/**
 * Notify the user by email for wallet credits and debits.
 * Fire-and-forget; errors are logged and never thrown to callers.
 */
export async function notifyWalletActivity(
  userId: string | mongoose.Types.ObjectId,
  direction: WalletDirection,
  amount: number,
  reason: WalletReason,
  balanceAfter: number,
  description?: string,
  listingId?: string | mongoose.Types.ObjectId
): Promise<void> {
  try {
    await dbConnect();
    const uid =
      userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(String(userId));
    const user = await User.findById(uid).select('email name').lean<{ email?: string; name?: string } | null>();
    if (!user?.email) return;

    const listingUrl =
      reason === WALLET_TX_REASONS.BOOST_LISTING ? await resolveListingEmailUrl(listingId) : undefined;

    await sendWalletActivityEmail({
      to: user.email,
      name: user.name || 'there',
      direction,
      amount,
      balanceAfter,
      reasonLabel: reasonLabel(reason, direction),
      description,
      listingUrl,
    });
  } catch (e) {
    console.error('[wallet-emails] notifyWalletActivity failed:', e);
  }
}

/** @deprecated Use notifyWalletActivity — kept for call-site clarity. */
export function notifyWalletCredit(
  userId: string | mongoose.Types.ObjectId,
  amount: number,
  reason: WalletReason,
  balanceAfter: number,
  description?: string
): Promise<void> {
  return notifyWalletActivity(userId, WALLET_TX_TYPES.CREDIT, amount, reason, balanceAfter, description);
}
