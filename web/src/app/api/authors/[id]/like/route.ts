import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import AuthorLike from '@/models/AuthorLike';
import mongoose from 'mongoose';

/** GET /api/authors/[id]/like — like count and whether current user liked (optional auth). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    const { id: authorId } = await params;
    if (!mongoose.Types.ObjectId.isValid(authorId)) {
      return NextResponse.json({ error: 'Invalid author ID' }, { status: 400 });
    }
    await dbConnect();
    const aid = new mongoose.Types.ObjectId(authorId);
    const [likeCount, liked] = await Promise.all([
      AuthorLike.countDocuments({ authorId: aid }),
      session?.user?.id
        ? AuthorLike.findOne({ authorId: aid, userId: new mongoose.Types.ObjectId(session.user.id) }).lean()
        : null,
    ]);
    return NextResponse.json({
      likeCount,
      liked: !!liked,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to get like count' }, { status: 500 });
  }
}

/** POST /api/authors/[id]/like — toggle like (login required). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required to like' }, { status: 401 });
    }

    const { id: authorId } = await params;
    if (!mongoose.Types.ObjectId.isValid(authorId)) {
      return NextResponse.json({ error: 'Invalid author ID' }, { status: 400 });
    }

    if (String(authorId) === session.user.id) {
      return NextResponse.json({ error: 'You cannot like your own profile' }, { status: 403 });
    }

    await dbConnect();
    const author = await User.findById(authorId).select('_id').lean();
    if (!author) return NextResponse.json({ error: 'Author not found' }, { status: 404 });

    const userId = new mongoose.Types.ObjectId(session.user.id);
    const aid = new mongoose.Types.ObjectId(authorId);
    const existing = await AuthorLike.findOne({ userId, authorId: aid });
    if (existing) {
      await AuthorLike.deleteOne({ _id: existing._id });
    } else {
      await AuthorLike.create({ userId, authorId: aid });
    }
    const likeCount = await AuthorLike.countDocuments({ authorId: aid });
    return NextResponse.json({ liked: !existing, likeCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}
