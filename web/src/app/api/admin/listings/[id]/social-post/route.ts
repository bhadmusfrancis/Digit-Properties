import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import Listing from '@/models/Listing';
import { findListingByPublicParam } from '@/lib/resolve-listing';
import { USER_ROLES } from '@/lib/constants';
import { getSocialPostConfig, type SocialPlatform } from '@/lib/listing-social-post';
import { publishListingToSocial } from '@/lib/publish-listing-social';

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

    const published = await publishListingToSocial(listing, platform, { force });
    if (published.alreadyPosted) {
      return NextResponse.json(
        {
          error: 'Already posted. Confirm to post again.',
          alreadyPosted: true,
          facebook: published.facebook,
          twitter: published.twitter,
        },
        { status: 409 }
      );
    }

    if (published.anyOk) {
      await listing.save();
    }

    if (published.allAttemptedFailed) {
      return NextResponse.json(
        {
          error: published.facebook?.error || published.twitter?.error || 'Social post failed',
          facebook: published.facebook,
          twitter: published.twitter,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      facebook: published.facebook,
      twitter: published.twitter,
    });
  } catch (e) {
    console.error('[admin/listings/social-post]', e);
    return NextResponse.json({ error: 'Failed to post listing' }, { status: 500 });
  }
}
