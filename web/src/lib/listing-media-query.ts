/**
 * MongoDB match fragment: listing has real media (non-empty image or video URL).
 * Used for similar listings so only properties with photos/videos are shown.
 */
export const HAS_LISTING_MEDIA: Record<string, unknown> = {
  $or: [
    { images: { $elemMatch: { url: { $nin: [null, ''] } } } },
    { videos: { $elemMatch: { url: { $nin: [null, ''] } } } },
  ],
};
