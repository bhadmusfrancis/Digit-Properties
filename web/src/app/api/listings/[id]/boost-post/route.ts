import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import Listing from '@/models/Listing';
import { findListingByPublicParam } from '@/lib/resolve-listing';
import { BOOST_PACKAGES, boostSocialPlatform } from '@/lib/boost-packages';
import { isBoostActive } from '@/lib/listing-effective-limits';
import { getSocialPostConfig } from '@/lib/listing-social-post';
import { publishListingToSocial } from '@/lib/publish-listing-social';
import { USER_ROLES } from '@/lib/constants';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const found = await findListingByPublicParam(id);
    if (found.type !== 'listing') {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const listing = await Listing.findById(found.listing._id);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === USER_ROLES.ADMIN;
    const isOwner = listing.createdBy.toString() === session.user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isBoostActive(listing)) {
      return NextResponse.json(
        { error: 'Pay for a boost first, then add media and tap Boost Post Now.' },
        { status: 400 }
      );
    }

    if (listing.boostPostedAt) {
      return NextResponse.json(
        {
          error: 'This listing is already locked after Boost Post Now.',
          alreadyPosted: true,
          boostPostedAt: listing.boostPostedAt,
        },
        { status: 409 }
      );
    }

    const packageId = (listing.boostPackage || 'starter') as keyof typeof BOOST_PACKAGES;
    const pkg = BOOST_PACKAGES[packageId] ?? BOOST_PACKAGES.starter;
    const platform = boostSocialPlatform(pkg.id);
    const config = getSocialPostConfig();

    if (platform) {
      const result = await publishListingToSocial(listing, platform);
      if (result.allAttemptedFailed) {
        return NextResponse.json(
          {
            error: result.facebook?.error || result.twitter?.error || 'Social post failed',
            facebook: result.facebook,
            twitter: result.twitter,
          },
          { status: 502 }
        );
      }
      if (result.anyOk || result.alreadyPosted) {
        listing.boostPostedAt = new Date();
        await listing.save();
      } else {
        // Package includes social, but credentials are not configured — still lock.
        listing.boostPostedAt = new Date();
        await listing.save();
      }

      const skippedUnconfigured =
        (pkg.socialFacebook && !config.facebook) || (pkg.socialTwitter && !config.twitter);

      return NextResponse.json({
        ok: true,
        locked: true,
        boostPostedAt: listing.boostPostedAt,
        packageId: pkg.id,
        facebook: result.facebook,
        twitter: result.twitter,
        warning: skippedUnconfigured
          ? 'Listing locked. One or more social platforms are not configured on the server.'
          : undefined,
      });
    }

    listing.boostPostedAt = new Date();
    await listing.save();
    return NextResponse.json({
      ok: true,
      locked: true,
      boostPostedAt: listing.boostPostedAt,
      packageId: pkg.id,
    });
  } catch (e) {
    console.error('[listings/boost-post]', e);
    return NextResponse.json({ error: 'Failed to publish boost post' }, { status: 500 });
  }
}
