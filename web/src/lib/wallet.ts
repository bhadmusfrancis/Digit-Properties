import mongoose from 'mongoose';
import Wallet, { type IWallet } from '@/models/Wallet';
import WalletTransaction from '@/models/WalletTransaction';
import CouponCode from '@/models/CouponCode';
import { WALLET_TX_REASONS, WALLET_TX_TYPES } from '@/lib/constants';

type Reason = (typeof WALLET_TX_REASONS)[keyof typeof WALLET_TX_REASONS];

type ObjectIdInput = string | mongoose.Types.ObjectId;

interface BaseEntryOptions {
  reason: Reason;
  description?: string;
  paymentId?: ObjectIdInput;
  couponId?: ObjectIdInput;
  listingId?: ObjectIdInput;
  adId?: ObjectIdInput;
  adminId?: ObjectIdInput;
  metadata?: Record<string, unknown>;
}

function toId(v: ObjectIdInput | undefined): mongoose.Types.ObjectId | undefined {
  if (!v) return undefined;
  return v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(v);
}

/** Get (or lazily create) the wallet for a user. Always returns a hydrated document. */
export async function getOrCreateWallet(userId: ObjectIdInput): Promise<IWallet> {
  const uid = toId(userId)!;
  const wallet = await Wallet.findOneAndUpdate(
    { userId: uid },
    { $setOnInsert: { userId: uid, balance: 0, currency: 'NGN' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean<IWallet>();
  if (!wallet) throw new Error('Failed to load wallet');
  return wallet;
}

/** Read-only balance lookup. Returns 0 if no wallet exists yet. */
export async function getWalletBalance(userId: ObjectIdInput): Promise<number> {
  const uid = toId(userId)!;
  const wallet = await Wallet.findOne({ userId: uid }).select('balance').lean<{ balance: number } | null>();
  return wallet?.balance ?? 0;
}

/**
 * Credit a user's wallet by `amount` (NGN). Atomically increments the balance
 * and writes a ledger entry. Idempotent only if the caller dedupes on
 * `paymentId` / `couponId` upstream (we don't double-check here).
 */
export async function creditWallet(
  userId: ObjectIdInput,
  amount: number,
  opts: BaseEntryOptions
): Promise<{ balanceAfter: number; transactionId: mongoose.Types.ObjectId }> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be > 0');
  const uid = toId(userId)!;
  const wallet = await Wallet.findOneAndUpdate(
    { userId: uid },
    { $inc: { balance: amount }, $setOnInsert: { userId: uid, currency: 'NGN' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (!wallet) throw new Error('Wallet update failed');
  const tx = await WalletTransaction.create({
    userId: uid,
    walletId: wallet._id,
    amount,
    type: WALLET_TX_TYPES.CREDIT,
    reason: opts.reason,
    balanceAfter: wallet.balance,
    description: opts.description,
    paymentId: toId(opts.paymentId),
    couponId: toId(opts.couponId),
    listingId: toId(opts.listingId),
    adId: toId(opts.adId),
    adminId: toId(opts.adminId),
    metadata: opts.metadata,
  });
  return { balanceAfter: wallet.balance, transactionId: tx._id };
}

/**
 * Debit a user's wallet by `amount`. Returns `{ ok: false }` (no ledger entry)
 * when the balance is insufficient — caller should fall back to a gateway.
 */
export async function debitWallet(
  userId: ObjectIdInput,
  amount: number,
  opts: BaseEntryOptions
): Promise<
  | { ok: true; balanceAfter: number; transactionId: mongoose.Types.ObjectId }
  | { ok: false; reason: 'insufficient_funds' }
> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be > 0');
  const uid = toId(userId)!;
  const wallet = await Wallet.findOneAndUpdate(
    { userId: uid, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );
  if (!wallet) return { ok: false, reason: 'insufficient_funds' };
  const tx = await WalletTransaction.create({
    userId: uid,
    walletId: wallet._id,
    amount,
    type: WALLET_TX_TYPES.DEBIT,
    reason: opts.reason,
    balanceAfter: wallet.balance,
    description: opts.description,
    paymentId: toId(opts.paymentId),
    couponId: toId(opts.couponId),
    listingId: toId(opts.listingId),
    adId: toId(opts.adId),
    adminId: toId(opts.adminId),
    metadata: opts.metadata,
  });
  return { ok: true, balanceAfter: wallet.balance, transactionId: tx._id };
}

export type CouponRedemptionResult =
  | { ok: true; amount: number; balanceAfter: number; couponId: string }
  | { ok: false; error: 'not_found' | 'inactive' | 'expired' | 'exhausted' | 'already_redeemed' };

/**
 * Atomically redeem a coupon code for the given user.
 *
 * Uses a conditional `findOneAndUpdate` to guarantee that:
 *   - The coupon exists, is active, has not expired, has redemptions left.
 *   - The user has not already redeemed it.
 *
 * On success, credits the user's wallet for `coupon.amount`.
 */
export async function redeemCoupon(
  userId: ObjectIdInput,
  rawCode: string
): Promise<CouponRedemptionResult> {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'not_found' };

  const uid = toId(userId)!;
  const now = new Date();

  // First fetch (cheap) to map errors precisely for the user.
  const existing = await CouponCode.findOne({ code }).lean();
  if (!existing) return { ok: false, error: 'not_found' };
  if (!existing.active) return { ok: false, error: 'inactive' };
  if (existing.expiresAt && new Date(existing.expiresAt) < now) return { ok: false, error: 'expired' };
  if (existing.redeemedCount >= existing.maxRedemptions) return { ok: false, error: 'exhausted' };
  if (existing.redemptions?.some((r) => r.userId.toString() === uid.toString())) {
    return { ok: false, error: 'already_redeemed' };
  }

  // Atomic claim: only succeeds if conditions still hold and the user has not been added.
  const claimed = await CouponCode.findOneAndUpdate(
    {
      _id: existing._id,
      active: true,
      $expr: { $lt: ['$redeemedCount', '$maxRedemptions'] },
      'redemptions.userId': { $ne: uid },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
    },
    {
      $inc: { redeemedCount: 1 },
      $push: { redemptions: { userId: uid, redeemedAt: now } },
    },
    { new: true }
  );
  if (!claimed) {
    // Re-evaluate to give a precise error.
    const fresh = await CouponCode.findById(existing._id).lean();
    if (!fresh) return { ok: false, error: 'not_found' };
    if (fresh.redemptions?.some((r) => r.userId.toString() === uid.toString())) {
      return { ok: false, error: 'already_redeemed' };
    }
    if (fresh.redeemedCount >= fresh.maxRedemptions) return { ok: false, error: 'exhausted' };
    if (!fresh.active) return { ok: false, error: 'inactive' };
    if (fresh.expiresAt && new Date(fresh.expiresAt) < new Date()) return { ok: false, error: 'expired' };
    return { ok: false, error: 'not_found' };
  }

  const credit = await creditWallet(uid, claimed.amount, {
    reason: WALLET_TX_REASONS.COUPON_REDEMPTION,
    couponId: claimed._id,
    description: `Coupon ${claimed.code}`,
  });

  // Best-effort: store the wallet tx id back on the redemption record for audit.
  await CouponCode.updateOne(
    { _id: claimed._id, 'redemptions.userId': uid },
    { $set: { 'redemptions.$.walletTransactionId': credit.transactionId } }
  );

  return {
    ok: true,
    amount: claimed.amount,
    balanceAfter: credit.balanceAfter,
    couponId: claimed._id.toString(),
  };
}
