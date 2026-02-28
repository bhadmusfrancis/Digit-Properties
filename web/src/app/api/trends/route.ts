import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { TREND_STATUS } from '@/lib/constants';

/** Public: list published trend posts. */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));

    const filter: Record<string, unknown> = { status: TREND_STATUS.PUBLISHED };
    if (category) filter.category = category;

    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      Trend.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title slug excerpt category imageUrl author publishedAt createdAt')
        .lean(),
      Trend.countDocuments(filter),
    ]);

    return NextResponse.json({
      posts: posts.map((p) => ({
        ...p,
        _id: String(p._id),
        publishedAt: p.publishedAt?.toISOString(),
        createdAt: p.createdAt?.toISOString(),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ posts: [], pagination: { page: 1, limit: 12, total: 0, pages: 0 } });
  }
}
