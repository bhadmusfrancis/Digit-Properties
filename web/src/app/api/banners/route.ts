import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Banner from '@/models/Banner';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slot = searchParams.get('slot');

    await dbConnect();
    const filter: Record<string, unknown> = { isActive: true };
    if (slot) filter.slot = slot;

    const banners = await Banner.find(filter)
      .lean();

    return NextResponse.json(banners);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 });
  }
}
