import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { resetPasswordSchema } from '@/lib/validations';

/**
 * POST /api/auth/reset-password
 * Body: { token: string, password: string }
 * Validates token, sets new password, clears token.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors.password?.[0] || parsed.error.flatten().fieldErrors.token?.[0] || 'Invalid input' },
        { status: 400 }
      );
    }
    const { token, password } = parsed.data;
    await dbConnect();
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });
    if (!user) {
      return NextResponse.json({ error: 'This reset link is invalid or has expired. Please request a new one.' }, { status: 400 });
    }
    const hashed = await bcrypt.hash(password, 12);
    user.password = hashed;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return NextResponse.json({ ok: true, message: 'Password updated. You can sign in now.' });
  } catch (e) {
    console.error('[reset-password]', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
