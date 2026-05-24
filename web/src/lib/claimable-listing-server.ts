import type { Types } from 'mongoose';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';

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
