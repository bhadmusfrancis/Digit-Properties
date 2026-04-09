import mongoose, { Schema, Model } from 'mongoose';

/**
 * Singleton document: how non-admin listing submissions are moderated.
 * If no row exists, code uses defaults (see getListingModerationConfig).
 */
export interface IListingModerationConfig {
  _id: mongoose.Types.ObjectId;
  /** When true, a user “publish” (active) becomes pending_approval until admin activates. */
  newListingsRequireApproval: boolean;
  /** When true, any save of an already-active listing by the owner forces pending_approval. */
  editedListingsRequireApproval: boolean;
  updatedAt: Date;
}

const ListingModerationConfigSchema = new Schema<IListingModerationConfig>(
  {
    newListingsRequireApproval: { type: Boolean, default: false },
    editedListingsRequireApproval: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const ListingModerationConfig: Model<IListingModerationConfig> =
  mongoose.models.ListingModerationConfig ??
  mongoose.model<IListingModerationConfig>('ListingModerationConfig', ListingModerationConfigSchema);
export default ListingModerationConfig;
