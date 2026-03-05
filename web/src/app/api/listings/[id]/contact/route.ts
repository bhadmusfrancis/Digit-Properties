import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { hasBaseVerification } from '@/lib/verification';
import mongoose from 'mongoose';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required to view contact details' }, { status: 401 });
    }
    await dbConnect();
    const user = await User.findById(session.user.id)
      .select('verifiedAt phoneVerifiedAt identityVerifiedAt livenessVerifiedAt role')
      .lean();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!hasBaseVerification(user)) {
      return NextResponse.json(
        {
          error: 'Complete verification to view contact details',
          code: 'VERIFICATION_REQUIRED',
          verificationUrl: '/dashboard/profile',
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const listing = await Listing.findById(id)
      .select('agentName agentPhone agentEmail title createdBy')
      .populate('createdBy', 'name phone email')
      .lean();
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const creator = listing.createdBy as { name?: string; phone?: string; email?: string } | null;
    const hasAgent = [listing.agentName, listing.agentPhone, listing.agentEmail].some(Boolean);
    return NextResponse.json({
      agentName: hasAgent ? listing.agentName : (creator?.name ?? listing.agentName),
      agentPhone: hasAgent ? listing.agentPhone : (creator?.phone ?? listing.agentPhone),
      agentEmail: hasAgent ? listing.agentEmail : (creator?.email ?? listing.agentEmail),
      title: listing.title,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 });
  }
}
