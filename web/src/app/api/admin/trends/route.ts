import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { USER_ROLES, TREND_STATUS, TREND_CATEGORIES } from '@/lib/constants';

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category')?.trim();
    const status = searchParams.get('status')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (status === TREND_STATUS.DRAFT || status === TREND_STATUS.PUBLISHED) filter.status = status;
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      Trend.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Trend.countDocuments(filter),
    ]);
    return NextResponse.json({
      posts: posts.map((p) => ({
        ...p,
        _id: String(p._id),
        publishedAt: p.publishedAt?.toISOString(),
        createdAt: p.createdAt?.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const { title, excerpt, content, category, imageUrl, author, status } = body;
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return NextResponse.json({ error: 'Title required (min 3 characters)' }, { status: 400 });
    }
    if (!TREND_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    let slug = typeof body.slug === 'string' ? body.slug.trim() : slugify(title);
    const finalStatus = status === TREND_STATUS.PUBLISHED ? TREND_STATUS.PUBLISHED : TREND_STATUS.DRAFT;
    await dbConnect();
    let uniqueSlug = slug;
    let n = 0;
    while (await Trend.findOne({ slug: uniqueSlug })) {
      n += 1;
      uniqueSlug = `${slug}-${n}`;
    }
    const doc = await Trend.create({
      title: title.trim(),
      slug: uniqueSlug,
      excerpt: typeof excerpt === 'string' ? excerpt.trim() : '',
      content: typeof content === 'string' ? content.trim() : '',
      category,
      imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() || undefined : undefined,
      author: typeof author === 'string' ? author.trim() || undefined : undefined,
      status: finalStatus,
      publishedAt: finalStatus === TREND_STATUS.PUBLISHED ? new Date() : undefined,
    });
    const post = doc.toObject();
    return NextResponse.json({
      ...post,
      _id: String(post._id),
      publishedAt: post.publishedAt?.toISOString(),
      createdAt: post.createdAt?.toISOString(),
      updatedAt: post.updatedAt?.toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
