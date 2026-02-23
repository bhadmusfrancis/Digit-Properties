import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { USER_ROLES } from '@/lib/constants';
import { sendTestEmail } from '@/lib/email';

export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await sendTestEmail();
  return NextResponse.json(result);
}
