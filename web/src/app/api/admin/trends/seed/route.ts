import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Trend from '@/models/Trend';
import { USER_ROLES, TREND_STATUS } from '@/lib/constants';
import { TRENDS_SEED_FULL } from '@/lib/trends-seed-data';
import { uploadPicsumToCloudinary } from '@/lib/trend-image';

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const BATCH_SIZE = 5;

/** Admin: seed 30 Nigeria trend posts (with images) if collection is empty (or force=true). */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    await dbConnect();
    const existing = await Trend.countDocuments();
    if (existing > 0 && !force) {
      return NextResponse.json({ message: 'Trends already seeded. Use force: true to add again.', count: 0 });
    }
    const now = new Date();
    let slugIndex: Record<string, number> = {};
    const docs = TRENDS_SEED_FULL.map((item) => {
      let slug = slugify(item.title);
      slugIndex[slug] = (slugIndex[slug] ?? 0) + 1;
      if (slugIndex[slug] > 1) slug = `${slug}-${slugIndex[slug]}`;
      return {
        title: item.title,
        slug,
        excerpt: item.excerpt,
        content: item.content,
        category: item.category,
        author: typeof item.author === 'string' ? item.author : undefined,
        status: TREND_STATUS.PUBLISHED,
        publishedAt: now,
      };
    });
    if (force && existing > 0) await Trend.deleteMany({});
    const inserted = await Trend.insertMany(docs);

    for (let i = 0; i < inserted.length; i += BATCH_SIZE) {
      const batch = inserted.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (doc) => {
          const url = await uploadPicsumToCloudinary(String(doc._id), doc.title, doc.slug);
          await Trend.findByIdAndUpdate(doc._id, { imageUrl: url });
        })
      );
    }

    return NextResponse.json({ message: 'Seeded successfully with images', count: inserted.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}
