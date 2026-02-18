import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { registerSchema } from '@/lib/validations';
import { USER_ROLES } from '@/lib/constants';
import { sendWelcomeEmail, sendAdminNewUser } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { email, name, password } = parsed.data;
    await dbConnect();
    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      name,
      password: hashed,
      role: USER_ROLES.GUEST,
    });
    sendWelcomeEmail(email, name).catch((e) => console.error('[register] welcome email:', e));
    sendAdminNewUser(name, email).catch((e) => console.error('[register] admin email:', e));
    return NextResponse.json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
