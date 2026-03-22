import type { Types } from 'mongoose';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';

/**
 * Listings can be claimed when they were ingested as bot pipeline (createdByType bot)
 * OR when the listing owner account is a BOT user (e.g. imports attributed to the bot user).
 */
export function isClaimableListingDoc(doc: {
  createdByType?: string;
  createdBy?: unknown;
}): boolean {
  if (doc?.createdByType === 'bot') return true;
  const cb = doc?.createdBy;
  if (cb && typeof cb === 'object' && cb !== null && 'role' in cb) {
    if ((cb as { role?: string }).role === USER_ROLES.BOT) return true;
  }
  return false;
}

/** IDs of users with role BOT — for Mongo queries without populate. */
export async function getBotUserObjectIds(): Promise<Types.ObjectId[]> {
  const ids = await User.find({ role: USER_ROLES.BOT }).distinct('_id');
  return ids as Types.ObjectId[];
}

/** Match listings that are claimable (bot type or created by bot account). */
export async function claimableListingsMatch(): Promise<Record<string, unknown>> {
  const botIds = await getBotUserObjectIds();
  return {
    $or: [
      { createdByType: 'bot' },
      ...(botIds.length > 0 ? [{ createdBy: { $in: botIds } }] : []),
    ],
  };
}
