import type { IListing } from '@/models/Listing';
import { postListingToFacebookPage } from '@/lib/facebook-page-post';
import { postListingToTwitter } from '@/lib/twitter-page-post';
import {
  buildFacebookCaption,
  buildTwitterText,
  collectListingSocialMedia,
  facebookMediaPlan,
  getSocialPostConfig,
  listingPublicUrl,
  listingToShareFields,
  twitterMediaPlan,
  type SocialPlatform,
  type SocialPostResult,
} from '@/lib/listing-social-post';

export type PublishListingSocialResult = {
  facebook?: SocialPostResult;
  twitter?: SocialPostResult;
  wantFacebook: boolean;
  wantTwitter: boolean;
  facebookAlready: boolean;
  twitterAlready: boolean;
  alreadyPosted: boolean;
  anyOk: boolean;
  allAttemptedFailed: boolean;
};

type SocialListingDoc = IListing & {
  toObject?: () => Record<string, unknown>;
};

function listingPlain(listing: SocialListingDoc): Record<string, unknown> {
  if (typeof listing.toObject === 'function') return listing.toObject();
  return listing as unknown as Record<string, unknown>;
}

/**
 * Post a listing to Facebook and/or X. Updates `facebookPostId` / `twitterPostId`
 * on the in-memory document; caller is responsible for `save()`.
 */
export async function publishListingToSocial(
  listing: SocialListingDoc,
  platform: SocialPlatform,
  options?: { force?: boolean }
): Promise<PublishListingSocialResult> {
  const force = options?.force === true;
  const config = getSocialPostConfig();
  const wantFacebook = (platform === 'facebook' || platform === 'both') && config.facebook;
  const wantTwitter = (platform === 'twitter' || platform === 'both') && config.twitter;

  const existingFacebook = typeof listing.facebookPostId === 'string' ? listing.facebookPostId.trim() : '';
  const existingTwitter = typeof listing.twitterPostId === 'string' ? listing.twitterPostId.trim() : '';
  const facebookAlready = wantFacebook && Boolean(existingFacebook) && !force;
  const twitterAlready = wantTwitter && Boolean(existingTwitter) && !force;
  const alreadyPosted =
    (wantFacebook ? facebookAlready : true) && (wantTwitter ? twitterAlready : true);

  const facebook: SocialPostResult | undefined = wantFacebook
    ? facebookAlready
      ? { ok: false, skipped: true, alreadyPosted: true, postId: existingFacebook }
      : undefined
    : undefined;
  const twitter: SocialPostResult | undefined = wantTwitter
    ? twitterAlready
      ? { ok: false, skipped: true, alreadyPosted: true, postId: existingTwitter }
      : undefined
    : undefined;

  const result: PublishListingSocialResult = {
    facebook,
    twitter,
    wantFacebook,
    wantTwitter,
    facebookAlready,
    twitterAlready,
    alreadyPosted,
    anyOk: false,
    allAttemptedFailed: false,
  };

  if (alreadyPosted) {
    result.allAttemptedFailed = false;
    return result;
  }

  const plain = listingPlain(listing);
  const shareFields = listingToShareFields(plain);
  const listingUrl = listingPublicUrl({ _id: listing._id, slug: listing.slug });
  const media = collectListingSocialMedia(plain);

  if (wantFacebook && !facebookAlready) {
    try {
      const plan = facebookMediaPlan(media);
      const posted = await postListingToFacebookPage({
        caption: buildFacebookCaption(shareFields, listingUrl),
        listingUrl,
        photos: plan.photos,
        video: plan.video,
      });
      listing.facebookPostId = posted.postId;
      listing.facebookPostedAt = new Date();
      result.facebook = { ok: true, postId: posted.postId, url: posted.url };
    } catch (e) {
      result.facebook = {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to post to Facebook',
      };
    }
  }

  if (wantTwitter && !twitterAlready) {
    try {
      const plan = twitterMediaPlan(media);
      const posted = await postListingToTwitter({
        text: buildTwitterText(shareFields, listingUrl),
        photos: plan.photos,
        video: plan.video,
      });
      listing.twitterPostId = posted.postId;
      listing.twitterPostedAt = new Date();
      result.twitter = { ok: true, postId: posted.postId, url: posted.url };
    } catch (e) {
      result.twitter = {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to post to X',
      };
    }
  }

  const attemptedFacebook = wantFacebook && !facebookAlready;
  const attemptedTwitter = wantTwitter && !twitterAlready;
  result.anyOk = Boolean(result.facebook?.ok || result.twitter?.ok);
  result.allAttemptedFailed =
    (attemptedFacebook || attemptedTwitter) &&
    (attemptedFacebook ? !result.facebook?.ok : true) &&
    (attemptedTwitter ? !result.twitter?.ok : true);

  return result;
}
