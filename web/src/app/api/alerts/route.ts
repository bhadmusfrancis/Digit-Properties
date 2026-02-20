import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Alert from '@/models/Alert';
import { alertSchema } from '@/lib/validations';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const alerts = await Alert.find({ userId: session.user.id }).sort({ createdAt: -1 }).lean();
    return NextResponse.json(alerts);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = alertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await dbConnect();
    const alert = await Alert.create({
      ...parsed.data,
      userId: session.user.id,
    });

    return NextResponse.json(alert);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}
