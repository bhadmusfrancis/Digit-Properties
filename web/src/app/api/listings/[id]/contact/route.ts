import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import mongoose from 'mongoose';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required to view contact details' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.findById(id).select('agentName agentPhone agentEmail title').lean();
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      agentName: listing.agentName,
      agentPhone: listing.agentPhone,
      agentEmail: listing.agentEmail,
      title: listing.title,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 });
  }
}
