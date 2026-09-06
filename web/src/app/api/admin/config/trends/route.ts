import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import TrendConfig from '@/models/TrendConfig';
import { USER_ROLES } from '@/lib/constants';
import { getTrendConfig } from '@/lib/trend-config';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const config = await getTrendConfig();
    return NextResponse.json(config);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load trends config' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    if (typeof body?.autoPublish !== 'boolean') {
      return NextResponse.json({ error: 'Body must include autoPublish (boolean).' }, { status: 400 });
    }

    await dbConnect();
    let doc = await TrendConfig.findOne();
    if (!doc) doc = await TrendConfig.create({});
    doc.autoPublish = body.autoPublish;
    await doc.save();

    return NextResponse.json({ autoPublish: doc.autoPublish });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to save trends config' }, { status: 500 });
  }
}
