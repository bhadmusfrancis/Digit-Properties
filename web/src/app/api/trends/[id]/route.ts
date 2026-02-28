import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { TREND_STATUS } from '@/lib/constants';

/** Public: get single published trend by id or slug. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();

    const isId = mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
    const filter: Record<string, unknown> = { status: TREND_STATUS.PUBLISHED };
    if (isId) filter._id = id;
    else filter.slug = id;

    const post = await Trend.findOne(filter).lean();
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      ...post,
      _id: String(post._id),
      publishedAt: post.publishedAt?.toISOString(),
      createdAt: post.createdAt?.toISOString(),
      updatedAt: post.updatedAt?.toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
