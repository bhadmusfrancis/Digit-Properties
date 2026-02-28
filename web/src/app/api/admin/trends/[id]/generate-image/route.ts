import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { USER_ROLES } from '@/lib/constants';
import { uploadPicsumToCloudinary } from '@/lib/trend-image';

/** Admin: assign a unique image to one trend (Picsum → Cloudinary). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || (session.user as { role?: string }).role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    await dbConnect();
    const post = await Trend.findById(id);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const url = await uploadPicsumToCloudinary(id, post.title, post.slug);
    post.imageUrl = url;
    await post.save();

    return NextResponse.json({ url: post.imageUrl });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : 'Generate image failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
