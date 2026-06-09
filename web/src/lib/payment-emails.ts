import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import Listing from '@/models/Listing';
import { PAYMENT_PURPOSE } from '@/lib/constants';
import { buildListingEmailUrl } from '@/lib/listing-email-link';
import { sendPaymentActivityEmail } from '@/lib/email';

export type PaymentNotifyInput = {
  userId: string | mongoose.Types.ObjectId;
  amount: number;
  purpose: string;
  gateway: string;
  gatewayRef?: string;
  metadata?: Record<string, unknown>;
  listingId?: string | mongoose.Types.ObjectId;
};

const PURPOSE_LABELS: Record<string, string> = {
  [PAYMENT_PURPOSE.BOOST_LISTING]: 'Listing boost',
  [PAYMENT_PURPOSE.BANNER_AD]: 'Banner advert',
  [PAYMENT_PURPOSE.SUBSCRIPTION_TIER]: 'Subscription upgrade',
  [PAYMENT_PURPOSE.USER_AD]: 'Advert placement',
  [PAYMENT_PURPOSE.WALLET_TOPUP]: 'Wallet top-up',
};

const GATEWAY_LABELS: Record<string, string> = {
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
  wallet: 'Ad credit wallet',
};

function purposeLabel(purpose: string, metadata?: Record<string, unknown>): string {
  const base = PURPOSE_LABELS[purpose] ?? 'Payment';
  if (purpose === PAYMENT_PURPOSE.SUBSCRIPTION_TIER && metadata?.tier) {
    return `${base} (${String(metadata.tier)})`;
  }
  if (purpose === PAYMENT_PURPOSE.BOOST_LISTING && metadata?.boostPackage) {
    return `${base} (${String(metadata.boostPackage)})`;
  }
  return base;
}

function gatewayLabel(gateway: string): string {
  return GATEWAY_LABELS[gateway] ?? gateway;
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
 * Email for successful card/gateway payments (Paystack, Flutterwave).
 * Skips wallet-settled payments and wallet top-ups (those use wallet ledger emails).
 */
export async function notifyPaymentSuccess(payment: PaymentNotifyInput): Promise<void> {
  if (!payment.userId) return;
  if (payment.gateway === 'wallet') return;
  if (payment.purpose === PAYMENT_PURPOSE.WALLET_TOPUP) return;
  if (!Number.isFinite(payment.amount) || payment.amount <= 0) return;

  try {
    await dbConnect();
    const uid =
      payment.userId instanceof mongoose.Types.ObjectId
        ? payment.userId
        : new mongoose.Types.ObjectId(String(payment.userId));
    const user = await User.findById(uid).select('email name').lean<{ email?: string; name?: string } | null>();
    if (!user?.email) return;

    const listingId =
      payment.listingId ??
      (typeof payment.metadata?.listingId === 'string' ? payment.metadata.listingId : undefined);
    const listingUrl =
      payment.purpose === PAYMENT_PURPOSE.BOOST_LISTING
        ? await resolveListingEmailUrl(listingId)
        : undefined;

    await sendPaymentActivityEmail({
      to: user.email,
      name: user.name || 'there',
      amount: payment.amount,
      purposeLabel: purposeLabel(payment.purpose, payment.metadata),
      gatewayLabel: gatewayLabel(payment.gateway),
      reference: payment.gatewayRef,
      listingUrl,
    });
  } catch (e) {
    console.error('[payment-emails] notifyPaymentSuccess failed:', e);
  }
}
