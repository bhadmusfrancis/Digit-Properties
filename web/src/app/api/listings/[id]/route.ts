import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { listingSchema } from '@/lib/validations';
import { LISTING_STATUS, USER_ROLES } from '@/lib/constants';
import mongoose from 'mongoose';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .populate('createdBy', 'name image role verifiedAt')
      .lean();

    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      ...listing,
      isBoosted: listing.boostExpiresAt && new Date(listing.boostExpiresAt) > new Date(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.findById(id);
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAdmin = session.user.role === USER_ROLES.ADMIN;
    const isOwner = listing.createdBy.toString() === session.user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = listingSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    Object.assign(listing, parsed.data);
    await listing.save();

    return NextResponse.json(listing);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.findById(id);
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAdmin = session.user.role === USER_ROLES.ADMIN;
    const isOwner = listing.createdBy.toString() === session.user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await Listing.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 });
  }
}
