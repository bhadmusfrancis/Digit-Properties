import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import Listing from '@/models/Listing';
import { findListingByPublicParam } from '@/lib/resolve-listing';
import { USER_ROLES } from '@/lib/constants';
import {
  commentMarketStatusOnSocial,
  marketKindForListing,
  type MarketCommentPlatform,
} from '@/lib/publish-market-comment';

export const maxDuration = 120;
export const runtime = 'nodejs';

function parsePlatform(value: unknown): MarketCommentPlatform {
  if (value === 'facebook' || value === 'instagram' || value === 'twitter') return value;
  return 'all';
}

const PLATFORM_LABEL: Record<Exclude<MarketCommentPlatform, 'all'>, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X',
};

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

    const found = await findListingByPublicParam(id);
    if (found.type !== 'listing') {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    const listing = await Listing.findById(found.listing._id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const kind = marketKindForListing(listing);
    if (!kind) {
      return NextResponse.json(
        { error: 'Mark the listing as sold or rented before posting the update comment.' },
        { status: 400 }
      );
    }

    const result = await commentMarketStatusOnSocial(listing, { platform, force });

    if (result.noPosts) {
      return NextResponse.json(
        { error: 'Listing has not been posted to Facebook, Instagram, or X yet.' },
        { status: 400 }
      );
    }
    if (!result.wanted.facebook && !result.wanted.instagram && !result.wanted.twitter) {
      return NextResponse.json(
        {
          error: `Listing has no ${PLATFORM_LABEL[platform as Exclude<MarketCommentPlatform, 'all'>] ?? 'matching'} post to comment on.`,
        },
        { status: 400 }
      );
    }

    if (result.alreadyCommented) {
      return NextResponse.json(
        {
          error: 'Already commented. Confirm to comment again.',
          alreadyPosted: true,
          facebook: result.facebook,
          instagram: result.instagram,
          twitter: result.twitter,
        },
        { status: 409 }
      );
    }

    if (result.anyOk) {
      await listing.save();
    }

    if (result.allAttemptedFailed) {
      return NextResponse.json(
        {
          error:
            result.facebook?.error ||
            result.instagram?.error ||
            result.twitter?.error ||
            'Market status comment failed',
          facebook: result.facebook,
          instagram: result.instagram,
          twitter: result.twitter,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      kind: result.kind,
      facebook: result.facebook,
      instagram: result.instagram,
      twitter: result.twitter,
    });
  } catch (e) {
    console.error('[admin/listings/social-comment]', e);
    return NextResponse.json({ error: 'Failed to post market status comment' }, { status: 500 });
  }
}
