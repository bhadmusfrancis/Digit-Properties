import { Resend } from 'resend';
import { getEmailTemplate } from '@/lib/email-templates';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'contact@digitproperties.com';
/** Use RESEND_FROM_OVERRIDE to send from Resend's test address until your domain is verified. Example: Digit Properties <onboarding@resend.dev> */
const FROM_EMAIL =
  process.env.RESEND_FROM_OVERRIDE ||
  process.env.FROM_EMAIL ||
  'Digit Properties <noreply@digitproperties.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
const APP_NAME = 'Digit Properties';

function applyTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '');
  }
  return out;
}

function canSend(): boolean {
  return !!resend;
}

/** Send email via Resend. No-op if RESEND_API_KEY is not set. */
async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set, skipping send:', options.subject);
    return { ok: true, id: null };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: options.from || FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
    });
    if (error) {
      const errMsg = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message)
        : JSON.stringify(error);
      console.error('[email] Resend error:', errMsg, error);
      return { ok: false, error };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[email] Send failed:', errMsg, e);
    return { ok: false, error: e };
  }
}

// ---- Templates ----

function wrapBody(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <h1 style="color: #0d9488; font-size: 1.5rem;">${APP_NAME}</h1>
  <h2 style="font-size: 1.125rem; margin-top: 24px;">${title}</h2>
  <div style="margin-top: 16px; line-height: 1.6;">${body}</div>
  <p style="margin-top: 32px; font-size: 0.875rem; color: #6b7280;">
    &mdash; ${APP_NAME} Team<br />
    <a href="${APP_URL}" style="color: #0d9488;">${APP_URL}</a>
  </p>
</body>
</html>`;
}

export async function sendWelcomeEmail(to: string, name: string): Promise<{ ok: boolean }> {
  const vars = { name: name || 'there', appName: APP_NAME, appUrl: APP_URL };
  const t = await getEmailTemplate('welcome');
  const subject = t?.subject ? applyTemplate(t.subject, vars) : `Welcome to ${APP_NAME}`;
  const body = t?.body ? applyTemplate(t.body, vars) : `
    <p>Hi ${vars.name},</p>
    <p>Welcome to ${APP_NAME}! Your account has been created.</p>
    <p>You can now browse properties, save alerts, claim listings, and more.</p>
    <p><a href="${APP_URL}" style="color: #0d9488; text-decoration: underline;">Go to ${APP_NAME}</a></p>`;
  const result = await sendEmail({ to, subject, html: wrapBody('Welcome!', body) });
  if (!result.ok) console.error('[email] sendWelcomeEmail failed for', to, result.error);
  return { ok: result.ok };
}

/** Send verification link for new signups (credentials only). */
export async function sendVerificationEmail(to: string, name: string, verifyUrl: string): Promise<{ ok: boolean }> {
  const vars = { name: name || 'there', appName: APP_NAME, appUrl: APP_URL, verifyUrl };
  const t = await getEmailTemplate('email_verification');
  const subject = t?.subject ? applyTemplate(t.subject, vars) : `Verify your email – ${APP_NAME}`;
  const body = t?.body ? applyTemplate(t.body, vars) : `
    <p>Hi ${vars.name},</p>
    <p>Please verify your email address to activate your ${APP_NAME} account.</p>
    <p><a href="${verifyUrl}" style="color: #0d9488; font-weight: 600; text-decoration: underline;">Verify my email</a></p>
    <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`;
  const result = await sendEmail({ to, subject, html: wrapBody('Verify your email', body) });
  if (!result.ok) console.error('[email] sendVerificationEmail failed for', to, result.error);
  return { ok: result.ok };
}

export async function sendAdminNewUser(name: string, email: string): Promise<{ ok: boolean }> {
  const vars = { name, email, appName: APP_NAME, appUrl: APP_URL };
  const t = await getEmailTemplate('new_user_admin');
  const subject = t?.subject ? applyTemplate(t.subject, vars) : `[${APP_NAME}] New user: ${name}`;
  const body = t?.body ? applyTemplate(t.body, vars) : `
    <p>A new user has registered:</p>
    <ul><li><strong>Name:</strong> ${name}</li><li><strong>Email:</strong> ${email}</li></ul>
    <p><a href="${APP_URL}/admin" style="color: #0d9488;">View in admin</a></p>`;
  const result = await sendEmail({ to: ADMIN_EMAIL, subject, html: wrapBody('New User Registration', body) });
  if (!result.ok) console.error('[email] sendAdminNewUser failed to', ADMIN_EMAIL, result.error);
  return { ok: result.ok };
}

export async function sendAdminNewClaim(
  listingTitle: string,
  claimantName: string,
  claimantEmail: string,
  _claimId: string
): Promise<{ ok: boolean }> {
  const vars = { listingTitle, claimantName, claimantEmail, appName: APP_NAME, appUrl: APP_URL };
  const t = await getEmailTemplate('new_claim_admin');
  const subject = t?.subject ? applyTemplate(t.subject, vars) : `[${APP_NAME}] New claim: ${listingTitle}`;
  const body = t?.body ? applyTemplate(t.body, vars) : `
    <p>A new listing claim has been submitted:</p>
    <ul><li><strong>Listing:</strong> ${listingTitle}</li><li><strong>Claimant:</strong> ${claimantName} (${claimantEmail})</li></ul>
    <p><a href="${APP_URL}/dashboard/claims" style="color: #0d9488;">Review claim</a></p>`;
  const result = await sendEmail({ to: ADMIN_EMAIL, subject, html: wrapBody('New Listing Claim', body) });
  return { ok: result.ok };
}

export async function sendClaimApproved(
  to: string,
  listingTitle: string,
  listingId: string
): Promise<{ ok: boolean }> {
  const vars = { listingTitle, listingId, appName: APP_NAME, appUrl: APP_URL };
  const t = await getEmailTemplate('claim_approved');
  const subject = t?.subject ? applyTemplate(t.subject, vars) : `[${APP_NAME}] Claim approved: ${listingTitle}`;
  const body = t?.body ? applyTemplate(t.body, vars) : `
    <p>Good news! Your claim for <strong>${listingTitle}</strong> has been approved.</p>
    <p>You now own this listing and can manage it from your dashboard.</p>
    <p><a href="${APP_URL}/listings/${listingId}" style="color: #0d9488;">View listing</a></p>`;
  const result = await sendEmail({ to, subject, html: wrapBody('Claim Approved', body) });
  return { ok: result.ok };
}

export async function sendClaimRejected(
  to: string,
  listingTitle: string,
  reason?: string
): Promise<{ ok: boolean }> {
  const vars = { listingTitle, reason: reason ? `Reason: ${reason}` : '', appName: APP_NAME, appUrl: APP_URL };
  const t = await getEmailTemplate('claim_rejected');
  const subject = t?.subject ? applyTemplate(t.subject, vars) : `[${APP_NAME}] Claim update: ${listingTitle}`;
  const body = t?.body ? applyTemplate(t.body, vars) : `
    <p>Your claim for <strong>${listingTitle}</strong> was not approved.</p>
    ${vars.reason ? `<p>${vars.reason}</p>` : ''}
    <p>If you have questions, please contact us at ${ADMIN_EMAIL}.</p>
    <p><a href="${APP_URL}" style="color: #0d9488;">Browse listings</a></p>`;
  const result = await sendEmail({ to, subject, html: wrapBody('Claim Not Approved', body) });
  return { ok: result.ok };
}

export async function sendAdminNewListing(
  listingTitle: string,
  listingId: string,
  createdByName: string,
  listingType: string,
  price: number
): Promise<{ ok: boolean }> {
  const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(price);
  const vars = { listingTitle, listingId, createdByName, listingType, price: priceStr, appName: APP_NAME, appUrl: APP_URL };
  const t = await getEmailTemplate('new_listing_admin');
  const subject = t?.subject ? applyTemplate(t.subject, vars) : `[${APP_NAME}] New listing: ${listingTitle}`;
  const body = t?.body ? applyTemplate(t.body, vars) : `
    <p>A new listing has been published:</p>
    <ul><li><strong>Title:</strong> ${listingTitle}</li><li><strong>Type:</strong> ${listingType}</li><li><strong>Price:</strong> ${priceStr}</li><li><strong>By:</strong> ${createdByName}</li></ul>
    <p><a href="${APP_URL}/listings/${listingId}" style="color: #0d9488;">View listing</a></p>`;
  const result = await sendEmail({ to: ADMIN_EMAIL, subject, html: wrapBody('New Listing Published', body) });
  return { ok: result.ok };
}

export async function sendAlertMatchEmail(
  to: string,
  alertName: string,
  listings: Array<{ _id: string; title: string; price: number; listingType: string; rentPeriod?: string }>,
  baseUrl: string
): Promise<{ ok: boolean }> {
  const items = listings
    .slice(0, 5)
    .map(
      (l) =>
        `<li><a href="${baseUrl}/listings/${l._id}" style="color: #0d9488;">${l.title}</a> &ndash; ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(l.price)}${l.listingType === 'rent' && l.rentPeriod ? ` / ${l.rentPeriod}` : ''}</li>`
    )
    .join('');
  const more = listings.length > 5 ? `<p>...and ${listings.length - 5} more.</p>` : '';
  const body = `
    <p>Your alert <strong>${alertName}</strong> has new matches:</p>
    <ul>${items}</ul>
    ${more}
    <p><a href="${baseUrl}/listings" style="color: #0d9488;">Browse all listings</a></p>`;
  const result = await sendEmail({
    to,
    subject: `[${APP_NAME}] New listings matching "${alertName}"`,
    html: wrapBody('Alert: New Listings', body),
  });
  return { ok: result.ok };
}

export async function sendContactFormEmail(
  fromEmail: string,
  fromName: string,
  subject: string,
  message: string
): Promise<{ ok: boolean }> {
  const vars = { fromName, fromEmail, subject, message: message.replace(/\n/g, '<br />'), appName: APP_NAME };
  const t = await getEmailTemplate('contact_form');
  const emailSubject = t?.subject ? applyTemplate(t.subject, { ...vars, subject }) : `[${APP_NAME} Contact] ${subject}`;
  const body = t?.body ? applyTemplate(t.body, vars) : `
    <p><strong>From:</strong> ${fromName} &lt;${fromEmail}&gt;</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <hr />
    <p>${vars.message}</p>`;
  const result = await sendEmail({ to: ADMIN_EMAIL, subject: emailSubject, html: wrapBody('Contact form submission', body) });
  return { ok: result.ok };
}

/** Send a single test email to ADMIN_EMAIL. Returns detailed result for admin diagnostics. */
export async function sendTestEmail(): Promise<{
  ok: boolean;
  message: string;
  id?: string;
  errorDetail?: string;
}> {
  if (!resend) {
    return { ok: false, message: 'RESEND_API_KEY is not set.', errorDetail: 'Add RESEND_API_KEY to .env.local and restart the server.' };
  }
  const to = ADMIN_EMAIL;
  const from = FROM_EMAIL;
  const subject = `[${APP_NAME}] Test email`;
  const html = wrapBody('Test email', `<p>This is a test from ${APP_NAME}. If you received this, Resend is working.</p><p>From: <code>${from}</code></p>`);
  try {
    const { data, error } = await resend.emails.send({ from, to: [to], subject, html });
    if (error) {
      const errMsg = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message)
        : JSON.stringify(error);
      return { ok: false, message: 'Resend returned an error.', errorDetail: errMsg };
    }
    return { ok: true, message: `Test email sent to ${to}.`, id: data?.id };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: 'Send failed.', errorDetail: errMsg };
  }
}

export { canSend, ADMIN_EMAIL, FROM_EMAIL };
