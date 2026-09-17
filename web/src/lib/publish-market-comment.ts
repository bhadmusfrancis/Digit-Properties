import type { IListing } from '@/models/Listing';
import { postCommentOnFacebookPost } from '@/lib/facebook-page-post';
import { postCommentOnInstagramMedia } from '@/lib/instagram-page-post';
import { replyToTweet } from '@/lib/twitter-page-post';
import { listingPublicUrl, type SocialPostResult } from '@/lib/listing-social-post';
import {
  getCloudinaryVideoThumbnailUrl,
  getDefaultListingImageUrl,
  isVideoUrl,
} from '@/lib/listing-default-image';
import { siteOrigin } from '@/lib/site-metadata';

export type MarketKind = 'sold' | 'rented';
export type MarketCommentPlatform = 'facebook' | 'instagram' | 'twitter' | 'all';

export type MarketCommentResult = {
  kind: MarketKind;
  facebook?: SocialPostResult;
  instagram?: SocialPostResult;
  twitter?: SocialPostResult;
  /** Platforms the request targeted that actually have a social post. */
  wanted: { facebook: boolean; instagram: boolean; twitter: boolean };
  /** True when the listing was never posted to any platform. */
  noPosts: boolean;
  /** True when every targeted platform already has a market-status comment. */
  alreadyCommented: boolean;
  anyOk: boolean;
  allAttemptedFailed: boolean;
};

type SocialListingDoc = IListing & {
  toObject?: () => Record<string, unknown>;
};

type MediaRef = { url?: string; public_id?: string };

const MARKET_BANNER: Record<MarketKind, { label: string; color: string }> = {
  sold: { label: 'SOLD', color: 'dc2626' },
  rented: { label: 'RENTED', color: '4f46e5' },
};

export function marketKindForListing(listing: { soldAt?: unknown; rentedAt?: unknown }): MarketKind | null {
  if (listing.soldAt) return 'sold';
  if (listing.rentedAt) return 'rented';
  return null;
}

function marketBannerTransform(kind: MarketKind): string {
  const banner = MARKET_BANNER[kind];
  return `l_text:Arial_160_bold_letter_spacing_16:${banner.label},co_rgb:ffffff,b_rgb:${banner.color},bo_24px_solid_rgb:${banner.color},g_center,a_-8`;
}

function fetchWrapped(base: string, transform: string, remoteUrl: string): string {
  return `${base}/image/fetch/w_1200,c_limit/${transform}/f_jpg,q_auto/${encodeURIComponent(remoteUrl)}`;
}

/**
 * Sold/Rented picture for social comments: the listing's primary photo (or a
 * video frame / the default artwork) with a SOLD or RENTED banner overlaid via
 * Cloudinary URL transformations.
 */
export function marketStatusImageUrl(
  listing: {
    images?: MediaRef[] | null;
    videos?: MediaRef[] | null;
    propertyType?: string;
  },
  kind: MarketKind
): string | undefined {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || '';
  if (!cloud) return undefined;
  const base = `https://res.cloudinary.com/${cloud}`;
  const banner = marketBannerTransform(kind);

  for (const img of listing.images ?? []) {
    const url = typeof img?.url === 'string' ? img.url.trim() : '';
    const publicId = typeof img?.public_id === 'string' ? img.public_id.trim() : '';
    if (url && isVideoUrl(url)) continue;
    if (publicId) {
      return `${base}/image/upload/w_1200,c_limit/${banner}/f_jpg,q_auto/${publicId}`;
    }
    if (url.startsWith('http')) return fetchWrapped(base, banner, url);
  }

  for (const video of listing.videos ?? []) {
    const publicId = typeof video?.public_id === 'string' ? video.public_id.trim() : '';
    if (publicId) {
      return `${base}/video/upload/so_0/w_1200,c_limit/${banner}/f_jpg,q_auto/${publicId}`;
    }
    const thumb = getCloudinaryVideoThumbnailUrl(video ?? {});
    if (thumb) return fetchWrapped(base, banner, thumb);
  }

  const fallback = getDefaultListingImageUrl(listing.propertyType || 'apartment');
  const absolute = fallback.startsWith('http') ? fallback : `${siteOrigin()}${fallback}`;
  return fetchWrapped(base, banner, absolute);
}

export function buildMarketCommentText(
  kind: MarketKind,
  listingUrl: string,
  platform: Exclude<MarketCommentPlatform, 'all'>
): string {
  const label = MARKET_BANNER[kind].label;
  if (platform === 'twitter') {
    return `${label} — no longer available.\n${listingUrl}`;
  }
  return `${label} — this property is no longer available.\n\nView listing: ${listingUrl}\n#DigitProperties`;
}

function isFailedAttempt(result: SocialPostResult | undefined, attempted: boolean): boolean {
  if (!attempted) return true;
  if (!result) return true;
  if (result.ok || result.skipped) return false;
  return true;
}

function listingPlain(listing: SocialListingDoc): Record<string, unknown> {
  if (typeof listing.toObject === 'function') return listing.toObject();
  return listing as unknown as Record<string, unknown>;
}

/**
 * Post the Sold/Rented banner + note as a comment (X: reply) on each social
 * post the listing already has. Updates comment ids on the in-memory document;
 * caller is responsible for `save()`.
 */
export async function commentMarketStatusOnSocial(
  listing: SocialListingDoc,
  options?: { platform?: MarketCommentPlatform; force?: boolean }
): Promise<MarketCommentResult> {
  const kind = marketKindForListing(listing);
  if (!kind) throw new Error('Listing is not marked as sold or rented.');

  const force = options?.force === true;
  const platform = options?.platform ?? 'all';

  const fbPostId = typeof listing.facebookPostId === 'string' ? listing.facebookPostId.trim() : '';
  const igPostId = typeof listing.instagramPostId === 'string' ? listing.instagramPostId.trim() : '';
  const twPostId = typeof listing.twitterPostId === 'string' ? listing.twitterPostId.trim() : '';

  const wantFacebook = (platform === 'facebook' || platform === 'all') && Boolean(fbPostId);
  const wantInstagram = (platform === 'instagram' || platform === 'all') && Boolean(igPostId);
  const wantTwitter = (platform === 'twitter' || platform === 'all') && Boolean(twPostId);
  const wanted = { facebook: wantFacebook, instagram: wantInstagram, twitter: wantTwitter };
  const noPosts = !(fbPostId || igPostId || twPostId);

  const fbCommentId =
    typeof listing.facebookMarketCommentId === 'string' ? listing.facebookMarketCommentId.trim() : '';
  const igCommentId =
    typeof listing.instagramMarketCommentId === 'string' ? listing.instagramMarketCommentId.trim() : '';
  const twCommentId =
    typeof listing.twitterMarketCommentId === 'string' ? listing.twitterMarketCommentId.trim() : '';

  const fbDone = Boolean(fbCommentId) && !force;
  const igDone = Boolean(igCommentId) && !force;
  const twDone = Boolean(twCommentId) && !force;
  const alreadyCommented =
    (wantFacebook || wantInstagram || wantTwitter) &&
    (!wantFacebook || fbDone) &&
    (!wantInstagram || igDone) &&
    (!wantTwitter || twDone);

  const result: MarketCommentResult = {
    kind,
    wanted,
    noPosts,
    alreadyCommented,
    anyOk: false,
    allAttemptedFailed: false,
  };

  if (wantFacebook && fbDone) {
    result.facebook = { ok: false, skipped: true, alreadyPosted: true, postId: fbCommentId };
  }
  if (wantInstagram && igDone) {
    result.instagram = {
      ok: false,
      skipped: true,
      alreadyPosted: true,
      postId: igCommentId,
      url: typeof listing.instagramPermalink === 'string' ? listing.instagramPermalink : undefined,
    };
  }
  if (wantTwitter && twDone) {
    result.twitter = {
      ok: false,
      skipped: true,
      alreadyPosted: true,
      postId: twCommentId,
      url: `https://x.com/i/web/status/${twCommentId}`,
    };
  }
  if (alreadyCommented) return result;

  const plain = listingPlain(listing);
  const listingUrl = listingPublicUrl({ _id: listing._id, slug: listing.slug });
  let imageUrl: string | undefined;
  const ensureImage = () => {
    if (imageUrl === undefined) {
      imageUrl = marketStatusImageUrl(
        plain as { images?: MediaRef[] | null; videos?: MediaRef[] | null; propertyType?: string },
        kind
      );
    }
    return imageUrl;
  };

  if (wantFacebook && !fbDone) {
    try {
      const message = buildMarketCommentText(kind, listingUrl, 'facebook');
      let comment: { commentId: string };
      try {
        comment = await postCommentOnFacebookPost({
          postId: fbPostId,
          message,
          imageUrl: ensureImage(),
        });
      } catch (first) {
        if (!imageUrl) throw first;
        comment = await postCommentOnFacebookPost({ postId: fbPostId, message });
      }
      listing.facebookMarketCommentId = comment.commentId;
      result.facebook = { ok: true, postId: comment.commentId };
    } catch (e) {
      result.facebook = {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to comment on Facebook',
      };
    }
  }

  if (wantInstagram && !igDone) {
    try {
      // Instagram comments are text-only (no media attachments via the API).
      const comment = await postCommentOnInstagramMedia({
        mediaId: igPostId,
        message: buildMarketCommentText(kind, listingUrl, 'instagram'),
      });
      listing.instagramMarketCommentId = comment.commentId;
      result.instagram = { ok: true, postId: comment.commentId };
    } catch (e) {
      result.instagram = {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to comment on Instagram',
      };
    }
  }

  if (wantTwitter && !twDone) {
    try {
      const photo = ensureImage();
      const posted = await replyToTweet({
        tweetId: twPostId,
        text: buildMarketCommentText(kind, listingUrl, 'twitter'),
        photos: photo ? [photo] : [],
      });
      listing.twitterMarketCommentId = posted.postId;
      result.twitter = { ok: true, postId: posted.postId, url: posted.url };
    } catch (e) {
      result.twitter = {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to reply on X',
      };
    }
  }

  const attemptedFacebook = wantFacebook && !fbDone;
  const attemptedInstagram = wantInstagram && !igDone;
  const attemptedTwitter = wantTwitter && !twDone;
  result.anyOk = Boolean(result.facebook?.ok || result.instagram?.ok || result.twitter?.ok);
  result.allAttemptedFailed =
    (attemptedFacebook || attemptedInstagram || attemptedTwitter) &&
    isFailedAttempt(result.facebook, attemptedFacebook) &&
    isFailedAttempt(result.instagram, attemptedInstagram) &&
    isFailedAttempt(result.twitter, attemptedTwitter);

  return result;
}
