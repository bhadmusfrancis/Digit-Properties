import type { IListing } from '@/models/Listing';
import { postListingToFacebookPage } from '@/lib/facebook-page-post';
import { postListingToInstagram } from '@/lib/instagram-page-post';
import { postListingToTwitter } from '@/lib/twitter-page-post';
import {
  buildFacebookCaption,
  buildInstagramCaption,
  buildTwitterText,
  collectListingSocialMedia,
  facebookMediaPlan,
  getSocialPostConfig,
  instagramMediaPlan,
  listingPublicUrl,
  listingToShareFields,
  twitterMediaPlan,
  type SocialPlatform,
  type SocialPostResult,
} from '@/lib/listing-social-post';

export type PublishListingSocialResult = {
  facebook?: SocialPostResult;
  instagram?: SocialPostResult;
  twitter?: SocialPostResult;
  wantFacebook: boolean;
  wantInstagram: boolean;
  wantTwitter: boolean;
  facebookAlready: boolean;
  instagramAlready: boolean;
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

function isFailedAttempt(result: SocialPostResult | undefined, attempted: boolean): boolean {
  if (!attempted) return true;
  if (!result) return true;
  if (result.ok || result.skipped) return false;
  return true;
}

/**
 * Post a listing to Facebook (and Instagram) and/or X. Updates post ids
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
  const wantInstagram = wantFacebook;
  const wantTwitter = (platform === 'twitter' || platform === 'both') && config.twitter;

  const existingFacebook = typeof listing.facebookPostId === 'string' ? listing.facebookPostId.trim() : '';
  const existingInstagram = typeof listing.instagramPostId === 'string' ? listing.instagramPostId.trim() : '';
  const existingTwitter = typeof listing.twitterPostId === 'string' ? listing.twitterPostId.trim() : '';
  const facebookAlready = wantFacebook && Boolean(existingFacebook) && !force;
  const instagramAlready = wantInstagram && Boolean(existingInstagram) && !force;
  const twitterAlready = wantTwitter && Boolean(existingTwitter) && !force;
  const alreadyPosted =
    (wantFacebook ? facebookAlready : true) &&
    (wantInstagram ? instagramAlready : true) &&
    (wantTwitter ? twitterAlready : true);

  const facebook: SocialPostResult | undefined = wantFacebook
    ? facebookAlready
      ? { ok: false, skipped: true, alreadyPosted: true, postId: existingFacebook }
      : undefined
    : undefined;
  const instagram: SocialPostResult | undefined = wantInstagram
    ? instagramAlready
      ? {
          ok: false,
          skipped: true,
          alreadyPosted: true,
          postId: existingInstagram,
          url: typeof listing.instagramPermalink === 'string' ? listing.instagramPermalink : undefined,
        }
      : undefined
    : undefined;
  const twitter: SocialPostResult | undefined = wantTwitter
    ? twitterAlready
      ? { ok: false, skipped: true, alreadyPosted: true, postId: existingTwitter }
      : undefined
    : undefined;

  const result: PublishListingSocialResult = {
    facebook,
    instagram,
    twitter,
    wantFacebook,
    wantInstagram,
    wantTwitter,
    facebookAlready,
    instagramAlready,
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

  if (wantInstagram && !instagramAlready) {
    const plan = instagramMediaPlan(media);
    if (plan.photos.length === 0 && !plan.video) {
      result.instagram = {
        ok: false,
        skipped: true,
        error: 'Instagram requires at least one photo or video.',
      };
    } else {
      try {
        const posted = await postListingToInstagram({
          caption: buildInstagramCaption(shareFields, listingUrl),
          photos: plan.photos,
          video: plan.video,
        });
        listing.instagramPostId = posted.postId;
        listing.instagramPostedAt = new Date();
        listing.instagramPermalink = posted.url;
        result.instagram = { ok: true, postId: posted.postId, url: posted.url };
      } catch (e) {
        result.instagram = {
          ok: false,
          error: e instanceof Error ? e.message : 'Failed to post to Instagram',
        };
      }
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
  const attemptedInstagram = wantInstagram && !instagramAlready;
  const attemptedTwitter = wantTwitter && !twitterAlready;
  result.anyOk = Boolean(result.facebook?.ok || result.instagram?.ok || result.twitter?.ok);
  result.allAttemptedFailed =
    (attemptedFacebook || attemptedInstagram || attemptedTwitter) &&
    isFailedAttempt(result.facebook, attemptedFacebook) &&
    isFailedAttempt(result.instagram, attemptedInstagram) &&
    isFailedAttempt(result.twitter, attemptedTwitter);

  return result;
}
