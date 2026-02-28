import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { loginSchema } from '@/lib/validations';
import { USER_ROLES } from '@/lib/constants';
import { signToken } from '@/lib/auth-token';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
    }
    const { email, password } = parsed.data;
    await dbConnect();
    const user = await User.findOne({ email });
    if (!user?.password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    if (!user.verifiedAt && user.emailVerificationToken) {
      return NextResponse.json(
        { error: 'Please verify your email before signing in.', code: 'NEED_VERIFICATION', email: user.email },
        { status: 403 }
      );
    }
    const role = user.role ?? USER_ROLES.GUEST;
    const token = signToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role,
    });
    return NextResponse.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Sign in failed' }, { status: 500 });
  }
}
