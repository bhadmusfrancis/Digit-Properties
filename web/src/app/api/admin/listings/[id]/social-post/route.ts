import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import Listing from '@/models/Listing';
import { findListingByPublicParam } from '@/lib/resolve-listing';
import { USER_ROLES } from '@/lib/constants';
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

export const maxDuration = 60;
export const runtime = 'nodejs';

function parsePlatform(value: unknown): SocialPlatform | null {
  if (value === 'facebook' || value === 'twitter' || value === 'both') return value;
  return null;
}

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(getSocialPostConfig());
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const platform = parsePlatform(body?.platform);
    const force = body?.force === true;
    if (!platform) {
      return NextResponse.json({ error: 'platform must be facebook, twitter, or both' }, { status: 400 });
    }

    const config = getSocialPostConfig();
    const wantFacebook = (platform === 'facebook' || platform === 'both') && config.facebook;
    const wantTwitter = (platform === 'twitter' || platform === 'both') && config.twitter;
    if (platform === 'facebook' && !config.facebook) {
      return NextResponse.json(
        {
          error:
            'Facebook Page posting is not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.',
        },
        { status: 503 }
      );
    }
    if (platform === 'twitter' && !config.twitter) {
      return NextResponse.json(
        {
          error:
            'X posting is not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET.',
        },
        { status: 503 }
      );
    }
    if (platform === 'both' && !wantFacebook && !wantTwitter) {
      return NextResponse.json(
        { error: 'Neither Facebook nor X posting is configured.' },
        { status: 503 }
      );
    }

    const found = await findListingByPublicParam(id);
    if (found.type !== 'listing') {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    const listing = await Listing.findById(found.listing._id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const existingFacebook = typeof listing.facebookPostId === 'string' ? listing.facebookPostId.trim() : '';
    const existingTwitter = typeof listing.twitterPostId === 'string' ? listing.twitterPostId.trim() : '';
    const facebookAlready = wantFacebook && Boolean(existingFacebook) && !force;
    const twitterAlready = wantTwitter && Boolean(existingTwitter) && !force;

    if (
      (wantFacebook ? facebookAlready : true) &&
      (wantTwitter ? twitterAlready : true)
    ) {
      return NextResponse.json(
        {
          error: 'Already posted. Confirm to post again.',
          alreadyPosted: true,
          facebook: wantFacebook
            ? { ok: false, alreadyPosted: true, postId: existingFacebook }
            : undefined,
          twitter: wantTwitter
            ? { ok: false, alreadyPosted: true, postId: existingTwitter }
            : undefined,
        },
        { status: 409 }
      );
    }

    const shareFields = listingToShareFields(listing.toObject());
    const listingUrl = listingPublicUrl({ _id: listing._id, slug: listing.slug });
    const media = collectListingSocialMedia(listing.toObject());
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

    const result: { facebook?: SocialPostResult; twitter?: SocialPostResult } = { facebook, twitter };

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

    if (result.facebook?.ok || result.twitter?.ok) {
      await listing.save();
    }

    const attemptedFacebook = wantFacebook && !facebookAlready;
    const attemptedTwitter = wantTwitter && !twitterAlready;
    const facebookFailed = attemptedFacebook && !result.facebook?.ok;
    const twitterFailed = attemptedTwitter && !result.twitter?.ok;
    if (
      (attemptedFacebook || attemptedTwitter) &&
      (attemptedFacebook ? facebookFailed : true) &&
      (attemptedTwitter ? twitterFailed : true)
    ) {
      return NextResponse.json(
        {
          error: result.facebook?.error || result.twitter?.error || 'Social post failed',
          ...result,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error('[admin/listings/social-post]', e);
    return NextResponse.json({ error: 'Failed to post listing' }, { status: 500 });
  }
}
