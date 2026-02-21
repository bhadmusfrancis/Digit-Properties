import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import EmailTemplate from '@/models/EmailTemplate';
import { USER_ROLES } from '@/lib/constants';

const KEYS = ['welcome', 'new_user_admin', 'new_listing_admin', 'new_claim_admin', 'contact_form', 'claim_approved', 'claim_rejected'];

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await dbConnect();
  const list = await EmailTemplate.find({ key: { $in: KEYS } }).lean();
  const map: Record<string, { subject: string; body: string }> = {};
  KEYS.forEach((k) => {
    const t = list.find((x) => x.key === k);
    map[k] = t ? { subject: t.subject, body: t.body } : { subject: '', body: '' };
  });
  return NextResponse.json(map);
}

export async function PUT(req: Request) {
  const session = await getSession(req);
  if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const key = body.key;
  if (!key || !KEYS.includes(key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }
  await dbConnect();
  await EmailTemplate.findOneAndUpdate(
    { key },
    { subject: String(body.subject ?? ''), body: String(body.body ?? '') },
    { upsert: true }
  );
  return NextResponse.json({ success: true });
}
