import { LISTING_STATUS, USER_ROLES } from '@/lib/constants';

/** Normalize populated or raw `createdBy` from a listing document. */
export function getListingCreatedById(createdBy: unknown): string {
  if (createdBy && typeof createdBy === 'object' && '_id' in (createdBy as object)) {
    const id = (createdBy as { _id: unknown })._id;
    return id != null ? String(id) : '';
  }
  return createdBy != null ? String(createdBy) : '';
}

type SessionLike = { user?: { id?: string; role?: string } } | null;

/**
 * Public listing page and anonymous APIs: pending-approval listings are hidden
 * unless the viewer is the owner or an admin.
 */
export function canViewListingOnSite(args: {
  status: string | undefined;
  createdBy: unknown;
  session: SessionLike;
}): boolean {
  if (args.status !== LISTING_STATUS.PENDING_APPROVAL) return true;
  const role = args.session?.user?.role;
  if (role === USER_ROLES.ADMIN) return true;
  const uid = args.session?.user?.id;
  const ownerId = getListingCreatedById(args.createdBy);
  return !!uid && !!ownerId && uid === ownerId;
}
