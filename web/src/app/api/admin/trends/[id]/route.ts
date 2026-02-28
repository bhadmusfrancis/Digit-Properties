import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { USER_ROLES, TREND_STATUS, TREND_CATEGORIES } from '@/lib/constants';

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** Admin: get one trend. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    await dbConnect();
    const post = await Trend.findById(id).lean();
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

/** Admin: update trend. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    const body = await req.json();
    await dbConnect();
    const post = await Trend.findById(id);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.title != null && typeof body.title === 'string' && body.title.trim().length >= 3) {
      post.title = body.title.trim();
    }
    if (body.slug != null && typeof body.slug === 'string' && body.slug.trim()) {
      post.slug = body.slug.trim().toLowerCase().replace(/\s+/g, '-');
    } else if (body.title != null && typeof body.title === 'string') {
      post.slug = slugify(body.title);
    }
    if (body.excerpt != null) post.excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : '';
    if (body.content != null) post.content = typeof body.content === 'string' ? body.content.trim() : '';
    if (body.category != null && TREND_CATEGORIES.includes(body.category)) post.category = body.category;
    if (body.imageUrl !== undefined) post.imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() || undefined : undefined;
    if (body.author !== undefined) post.author = typeof body.author === 'string' ? body.author.trim() || undefined : undefined;
    if (body.status === TREND_STATUS.PUBLISHED || body.status === TREND_STATUS.DRAFT) {
      post.status = body.status;
      if (body.status === TREND_STATUS.PUBLISHED && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    await post.save();
    const out = post.toObject();
    return NextResponse.json({
      ...out,
      _id: String(out._id),
      publishedAt: out.publishedAt?.toISOString(),
      createdAt: out.createdAt?.toISOString(),
      updatedAt: out.updatedAt?.toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

/** Admin: delete trend. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    await dbConnect();
    const deleted = await Trend.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
