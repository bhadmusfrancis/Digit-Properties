import { dbConnect } from '@/lib/db';
import ListingModerationConfig from '@/models/ListingModerationConfig';

export type ListingModerationSettings = {
  newListingsRequireApproval: boolean;
  editedListingsRequireApproval: boolean;
};

const DEFAULTS: ListingModerationSettings = {
  /** Matches historical behaviour: first publish goes live without admin gate. */
  newListingsRequireApproval: false,
  /** Matches historical behaviour: owner edits to a live listing require re-approval. */
  editedListingsRequireApproval: true,
};

export async function getListingModerationConfig(): Promise<ListingModerationSettings> {
  await dbConnect();
  const doc = await ListingModerationConfig.findOne().lean();
  if (!doc) return { ...DEFAULTS };
  return {
    newListingsRequireApproval:
      typeof doc.newListingsRequireApproval === 'boolean'
        ? doc.newListingsRequireApproval
        : DEFAULTS.newListingsRequireApproval,
    editedListingsRequireApproval:
      typeof doc.editedListingsRequireApproval === 'boolean'
        ? doc.editedListingsRequireApproval
        : DEFAULTS.editedListingsRequireApproval,
  };
}
