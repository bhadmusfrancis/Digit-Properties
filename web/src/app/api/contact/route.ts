import { NextResponse } from 'next/server';
import { sendContactFormEmail } from '@/lib/email';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { contactFormSchema } from '@/lib/validations';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = contactFormSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const msg = first?.message ?? 'Invalid input';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { email, name, subject, message, captchaToken } = parsed.data;
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (secret) {
      if (!captchaToken) {
        return NextResponse.json(
          { error: 'Security check failed. Please refresh and try again.' },
          { status: 400 }
        );
      }
      const captcha = await verifyRecaptcha(captchaToken);
      if (!captcha.success) {
        return NextResponse.json(
          { error: 'Security check failed. Please try again.' },
          { status: 400 }
        );
      }
    }
    const result = await sendContactFormEmail(email, name, subject, message);
    if (!result.ok) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
