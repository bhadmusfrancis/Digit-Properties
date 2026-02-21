import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await dbConnect();
  const users = await User.find({})
    .select('name email role phone subscriptionTier createdAt')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const { email, name, password, role } = body;
  if (!email || !name || typeof email !== 'string' || typeof name !== 'string') {
    return NextResponse.json({ error: 'Email and name required' }, { status: 400 });
  }
  await dbConnect();
  const existing = await User.findOne({ email: String(email).trim() });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
  }
  const bcrypt = await import('bcryptjs');
  const hashed = password && typeof password === 'string' && password.length >= 8
    ? await bcrypt.default.hash(password, 12)
    : undefined;
  const user = await User.create({
    email: String(email).trim(),
    name: String(name).trim(),
    password: hashed,
    role: Object.values(USER_ROLES).includes(role) ? role : USER_ROLES.GUEST,
    phone: typeof body.phone === 'string' ? body.phone.trim() : undefined,
  });
  return NextResponse.json({
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}
