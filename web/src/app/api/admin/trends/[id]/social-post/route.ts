import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { USER_ROLES } from '@/lib/constants';
import { getSocialPostConfig, type SocialPlatform } from '@/lib/listing-social-post';
import { publishTrendToSocial } from '@/lib/publish-trend-social';

export const maxDuration = 120;
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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const platform = parsePlatform(body?.platform);
    const force = body?.force === true;
    if (!platform) {
      return NextResponse.json({ error: 'platform must be facebook, twitter, or both' }, { status: 400 });
    }

    const config = getSocialPostConfig();
    if (platform === 'facebook' && !config.facebook) {
      return NextResponse.json(
        { error: 'Facebook Page posting is not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.' },
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
    if (platform === 'both' && !config.facebook && !config.twitter) {
      return NextResponse.json({ error: 'Neither Facebook nor X posting is configured.' }, { status: 503 });
    }

    await dbConnect();
    const trend = await Trend.findById(id);
    if (!trend) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const published = await publishTrendToSocial(trend, platform, { force });
    if (published.alreadyPosted) {
      return NextResponse.json(
        {
          error: 'Already posted. Confirm to post again.',
          alreadyPosted: true,
          facebook: published.facebook,
          instagram: published.instagram,
          twitter: published.twitter,
        },
        { status: 409 }
      );
    }

    if (published.anyOk) {
      await trend.save();
    }

    if (published.allAttemptedFailed) {
      return NextResponse.json(
        {
          error:
            published.facebook?.error ||
            published.instagram?.error ||
            published.twitter?.error ||
            'Social post failed',
          facebook: published.facebook,
          instagram: published.instagram,
          twitter: published.twitter,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      facebook: published.facebook,
      instagram: published.instagram,
      twitter: published.twitter,
    });
  } catch (e) {
    console.error('[admin/trends/social-post]', e);
    return NextResponse.json({ error: 'Failed to post trend' }, { status: 500 });
  }
}
