import { NextResponse } from 'next/server';
import { sendContactFormEmail } from '@/lib/email';
import { verifyRecaptcha } from '@/lib/recaptcha';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, subject, message, captchaToken } = body;
    if (!email || !name || !subject || !message) {
      return NextResponse.json(
        { error: 'Email, name, subject and message are required' },
        { status: 400 }
      );
    }
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (secret) {
      if (!captchaToken || typeof captchaToken !== 'string') {
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
    const result = await sendContactFormEmail(
      String(email).trim(),
      String(name).trim(),
      String(subject).trim(),
      String(message).trim()
    );
    if (!result.ok) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
