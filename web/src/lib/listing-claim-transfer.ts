import mongoose from 'mongoose';

/** Fields applied when a user becomes owner via an approved claim. */
export function listingOwnershipTransferUpdate(userId: mongoose.Types.ObjectId | string) {
  return {
    createdBy: userId,
    createdByType: 'user' as const,
    claimedAt: new Date(),
  };
}
