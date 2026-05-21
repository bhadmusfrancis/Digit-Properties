import { NextResponse } from 'next/server';
import { siteOrigin } from '@/lib/site-metadata';

const APP_URL = siteOrigin();

/**
 * GET /api/auth/verify-phone?token=xxx
 * Link-based phone verification is disabled. Phone must be verified via SMS/WhatsApp OTP only.
 */
export async function GET() {
  return NextResponse.redirect(`${APP_URL}/dashboard/profile?error=PhoneVerificationLinkDisabled`);
}
