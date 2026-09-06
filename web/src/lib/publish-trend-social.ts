import { siteOrigin } from '@/lib/site-metadata';
import { formatImageCreditLine } from '@/lib/trends/images';
import { plainTextExcerpt } from '@/lib/utils';
import type { ITrend } from '@/models/Trend';
import {
  getSocialPostConfig,
  type SocialPlatform,
  type SocialPostResult,
} from '@/lib/listing-social-post';
import { postListingToFacebookPage } from '@/lib/facebook-page-post';
import { postListingToInstagram } from '@/lib/instagram-page-post';
import { postListingToTwitter } from '@/lib/twitter-page-post';

export function trendPublicUrl(trend: { slug: string }): string {
  return `${siteOrigin()}/trends/${trend.slug}`;
}

function buildTrendCaption(trend: ITrend, url: string): string {
  const title = trend.title.trim();
  const excerpt = plainTextExcerpt(trend.excerpt || '', 320, '');
  const credit = formatImageCreditLine({
    imageCredit: trend.imageCredit,
    imageSourceName: trend.imageSourceName,
    imageSourceUrl: trend.imageSourceUrl,
    imageLicense: trend.imageLicense,
  });
  const sources =
    Array.isArray(trend.sourceUrls) && trend.sourceUrls.length
      ? `Sources: ${trend.sourceUrls.slice(0, 3).join(' · ')}`
      : '';
  return [
    title,
    excerpt && excerpt.toLowerCase() !== title.toLowerCase() ? excerpt : '',
    `Read more: ${url}`,
    credit ? `Media: ${credit}` : '',
    sources,
    '#DigitProperties #NigerianRealEstate',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildTrendTweet(trend: ITrend, url: string): string {
  const reserved = 24;
  const max = 280 - reserved;
  let head = trend.title.trim();
  if (head.length > max) head = `${head.slice(0, Math.max(0, max - 1))}…`;
  return `${head}\n${url}`;
}

type TrendDoc = ITrend;

export type PublishTrendSocialResult = {
  facebook?: SocialPostResult;
  instagram?: SocialPostResult;
  twitter?: SocialPostResult;
  wantFacebook: boolean;
  wantInstagram: boolean;
  wantTwitter: boolean;
  alreadyPosted: boolean;
  anyOk: boolean;
  allAttemptedFailed: boolean;
};

function isFailedAttempt(result: SocialPostResult | undefined, attempted: boolean): boolean {
  if (!attempted) return true;
  if (!result) return true;
  if (result.ok || result.skipped) return false;
  return true;
}

export async function publishTrendToSocial(
  trend: TrendDoc,
  platform: SocialPlatform,
  options?: { force?: boolean }
): Promise<PublishTrendSocialResult> {
  const force = options?.force === true;
  const config = getSocialPostConfig();
  const wantFacebook = (platform === 'facebook' || platform === 'both') && config.facebook;
  const wantInstagram = wantFacebook;
  const wantTwitter = (platform === 'twitter' || platform === 'both') && config.twitter;

  const existingFacebook = typeof trend.facebookPostId === 'string' ? trend.facebookPostId.trim() : '';
  const existingInstagram = typeof trend.instagramPostId === 'string' ? trend.instagramPostId.trim() : '';
  const existingTwitter = typeof trend.twitterPostId === 'string' ? trend.twitterPostId.trim() : '';
  const facebookAlready = wantFacebook && Boolean(existingFacebook) && !force;
  const instagramAlready = wantInstagram && Boolean(existingInstagram) && !force;
  const twitterAlready = wantTwitter && Boolean(existingTwitter) && !force;
  const alreadyPosted =
    (wantFacebook ? facebookAlready : true) &&
    (wantInstagram ? instagramAlready : true) &&
    (wantTwitter ? twitterAlready : true);

  const result: PublishTrendSocialResult = {
    facebook: facebookAlready
      ? { ok: false, skipped: true, alreadyPosted: true, postId: existingFacebook }
      : undefined,
    instagram: instagramAlready
      ? {
          ok: false,
          skipped: true,
          alreadyPosted: true,
          postId: existingInstagram,
          url: trend.instagramPermalink,
        }
      : undefined,
    twitter: twitterAlready
      ? { ok: false, skipped: true, alreadyPosted: true, postId: existingTwitter }
      : undefined,
    wantFacebook,
    wantInstagram,
    wantTwitter,
    alreadyPosted,
    anyOk: false,
    allAttemptedFailed: false,
  };

  if (alreadyPosted) return result;

  const url = trendPublicUrl(trend);
  const caption = buildTrendCaption(trend, url);
  const photos = trend.imageUrl?.startsWith('http') ? [trend.imageUrl] : [];

  if (wantFacebook && !facebookAlready) {
    try {
      const posted = await postListingToFacebookPage({
        caption,
        listingUrl: url,
        photos,
      });
      trend.facebookPostId = posted.postId;
      trend.facebookPostedAt = new Date();
      result.facebook = { ok: true, postId: posted.postId, url: posted.url };
    } catch (e) {
      result.facebook = {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to post to Facebook',
      };
    }
  }

  if (wantInstagram && !instagramAlready) {
    if (photos.length === 0) {
      result.instagram = {
        ok: false,
        skipped: true,
        error: 'Instagram requires a trend hero image.',
      };
    } else {
      try {
        const posted = await postListingToInstagram({
          caption: caption.length > 2200 ? `${caption.slice(0, 2199)}…` : caption,
          photos,
        });
        trend.instagramPostId = posted.postId;
        trend.instagramPostedAt = new Date();
        trend.instagramPermalink = posted.url;
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
      const posted = await postListingToTwitter({
        text: buildTrendTweet(trend, url),
        photos,
      });
      trend.twitterPostId = posted.postId;
      trend.twitterPostedAt = new Date();
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
