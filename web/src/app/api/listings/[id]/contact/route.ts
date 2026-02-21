import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
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

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await dbConnect();
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
