/** Default transactional email templates (upserted by scripts/seed-email-templates.ts). */
export type EmailTemplateSeed = { key: string; subject: string; body: string };

export const EMAIL_TEMPLATE_SEEDS: EmailTemplateSeed[] = [
  {
    key: 'welcome',
    subject: 'Welcome to {{appName}}',
    body: `<p>Hi {{name}},</p>
<p>Welcome to {{appName}}! Your account has been created.</p>
<p>You can now browse properties, save alerts, claim listings, and more.</p>
<p><a href="{{appUrl}}" style="color: #0d9488; text-decoration: underline;">Go to {{appName}}</a></p>`,
  },
  {
    key: 'new_user_admin',
    subject: '[{{appName}}] New user: {{name}}',
    body: `<p>A new user has registered:</p>
<ul>
  <li><strong>Name:</strong> {{name}}</li>
  <li><strong>Email:</strong> {{email}}</li>
</ul>
<p><a href="{{appUrl}}/admin" style="color: #0d9488;">View in admin</a></p>`,
  },
  {
    key: 'new_listing_admin',
    subject: '[{{appName}}] New listing: {{listingTitle}}',
    body: `<p>A new listing has been published:</p>
<ul>
  <li><strong>Title:</strong> {{listingTitle}}</li>
  <li><strong>Type:</strong> {{listingType}}</li>
  <li><strong>Price:</strong> {{price}}</li>
  <li><strong>By:</strong> {{createdByName}}</li>
</ul>
<p><a href="{{appUrl}}/listings/{{listingId}}" style="color: #0d9488;">View listing</a></p>`,
  },
  {
    key: 'listing_pending_approval_admin',
    subject: '[{{appName}}] Listing pending approval: {{listingTitle}}',
    body: `<p>A listing is waiting for admin approval before it can go live:</p>
<ul>
  <li><strong>Title:</strong> {{listingTitle}}</li>
  <li><strong>Type:</strong> {{listingType}}</li>
  <li><strong>Price:</strong> {{price}}</li>
  <li><strong>By:</strong> {{createdByName}}</li>
  <li><strong>Flags:</strong> {{reasonsList}}</li>
</ul>
<p><a href="{{appUrl}}/admin/listings" style="color: #0d9488;">Review in admin</a> ·
<a href="{{appUrl}}/listings/{{listingId}}" style="color: #0d9488;">Preview listing</a></p>`,
  },
  {
    key: 'new_claim_admin',
    subject: '[{{appName}}] New claim: {{listingTitle}}',
    body: `<p>A new listing claim has been submitted:</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Claimant:</strong> {{claimantName}} ({{claimantEmail}})</li>
</ul>
<p><a href="{{appUrl}}/dashboard/claims" style="color: #0d9488;">Review claim</a></p>`,
  },
  {
    key: 'contact_form',
    subject: '[{{appName}} Contact] {{subject}}',
    body: `<p><strong>From:</strong> {{fromName}} &lt;{{fromEmail}}&gt;</p>
<p><strong>Subject:</strong> {{subject}}</p>
<hr />
<p>{{message}}</p>`,
  },
  {
    key: 'claim_approved',
    subject: '[{{appName}}] Claim approved: {{listingTitle}}',
    body: `<p>Good news! Your claim for <strong>{{listingTitle}}</strong> has been approved.</p>
<p>You now own this listing and can manage it from your dashboard.</p>
<p><strong>24-hour edit window:</strong> You can update this listing's details for 24 hours after your claim is approved. After that, only admins can edit it.</p>
<p><a href="{{appUrl}}/listings/{{listingId}}/edit" style="color: #0d9488;">Edit listing</a> · <a href="{{appUrl}}/listings/{{listingId}}" style="color: #0d9488;">View listing</a></p>`,
  },
  {
    key: 'email_verification',
    subject: 'Verify your email – {{appName}}',
    body: `<p>Hi {{name}},</p>
<p>Please verify your email address to activate your {{appName}} account.</p>
<p><a href="{{verifyUrl}}" style="color: #0d9488; font-weight: 600; text-decoration: underline;">Verify my email</a></p>
<p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
  },
  {
    key: 'password_reset',
    subject: 'Reset your password – {{appName}}',
    body: `<p>Hi {{name}},</p>
<p>You requested a password reset. Click the link below to set a new password.</p>
<p><a href="{{resetUrl}}" style="color: #0d9488; font-weight: 600; text-decoration: underline;">Reset my password</a></p>
<p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  },
  {
    key: 'claim_rejected',
    subject: '[{{appName}}] Claim update: {{listingTitle}}',
    body: `<p>Your claim for <strong>{{listingTitle}}</strong> was not approved.</p>
<p>{{reason}}</p>
<p>If you have questions, please contact us.</p>
<p><a href="{{appUrl}}" style="color: #0d9488;">Browse listings</a></p>`,
  },
  {
    key: 'send_offer_new',
    subject: '[{{appName}}] New offer on {{listingTitle}}',
    body: `<p>Hi {{recipientName}},</p>
<p>You received a new offer from <strong>{{buyerName}}</strong>.</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Offer Amount:</strong> {{offerAmount}}</li>
</ul>
<p><a href="{{listingUrl}}" style="color: #0d9488;">Review offer</a></p>`,
  },
  {
    key: 'send_offer_counter',
    subject: '[{{appName}}] Counter-offer on {{listingTitle}}',
    body: `<p>Hi {{recipientName}},</p>
<p>{{actorName}} sent a counter-offer on your listing.</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Latest Amount:</strong> {{offerAmount}}</li>
</ul>
<p><a href="{{listingUrl}}" style="color: #0d9488;">Respond to offer</a></p>`,
  },
  {
    key: 'send_offer_accepted',
    subject: '[{{appName}}] Your offer was accepted — {{listingTitle}}',
    body: `<p>Hi {{recipientName}},</p>
<p>Your offer has been <strong>accepted</strong>.</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Accepted Amount:</strong> {{offerAmount}}</li>
</ul>
<p><a href="{{listingUrl}}" style="color: #0d9488;">View listing</a></p>`,
  },
  {
    key: 'send_offer_declined',
    subject: '[{{appName}}] Offer declined — {{listingTitle}}',
    body: `<p>Hi {{recipientName}},</p>
<p>Your offer was declined by the seller.</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Last Amount:</strong> {{offerAmount}}</li>
</ul>
<p><a href="{{listingUrl}}" style="color: #0d9488;">View listing</a></p>`,
  },
  {
    key: 'send_offer_withdrawn',
    subject: '[{{appName}}] Offer withdrawn — {{listingTitle}}',
    body: `<p>Hi {{recipientName}},</p>
<p>{{buyerName}} withdrew their offer.</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Withdrawn Amount:</strong> {{offerAmount}}</li>
</ul>
<p><a href="{{listingUrl}}" style="color: #0d9488;">View listing</a></p>`,
  },
  {
    key: 'professional_offer_new',
    subject: '[{{appName}}] New professional offer on {{listingTitle}}',
    body: `<p>Hi {{recipientName}},</p>
<p>You received a new professional offer from <strong>{{buyerName}}</strong>.</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Offer Amount:</strong> {{offerAmount}}</li>
</ul>
<p><a href="{{listingUrl}}" style="color: #0d9488;">Review offer</a></p>`,
  },
  {
    key: 'professional_offer_counter',
    subject: '[{{appName}}] Counter-offer update on {{listingTitle}}',
    body: `<p>Hi {{recipientName}},</p>
<p>{{actorName}} has submitted a counter-offer.</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Latest Amount:</strong> {{offerAmount}}</li>
</ul>
<p><a href="{{listingUrl}}" style="color: #0d9488;">Respond to offer</a></p>`,
  },
  {
    key: 'professional_offer_accepted',
    subject: '[{{appName}}] Offer accepted for {{listingTitle}}',
    body: `<p>Hi {{recipientName}},</p>
<p>Your professional offer has been <strong>accepted</strong>.</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Accepted Amount:</strong> {{offerAmount}}</li>
</ul>
<p><a href="{{listingUrl}}" style="color: #0d9488;">View listing</a></p>`,
  },
  {
    key: 'professional_offer_declined',
    subject: '[{{appName}}] Offer update for {{listingTitle}}',
    body: `<p>Hi {{recipientName}},</p>
<p>Your professional offer was declined by the seller.</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Last Amount:</strong> {{offerAmount}}</li>
</ul>
<p><a href="{{listingUrl}}" style="color: #0d9488;">View listing</a></p>`,
  },
  {
    key: 'professional_offer_withdrawn',
    subject: '[{{appName}}] Offer withdrawn for {{listingTitle}}',
    body: `<p>Hi {{recipientName}},</p>
<p>{{buyerName}} has withdrawn their professional offer.</p>
<ul>
  <li><strong>Listing:</strong> {{listingTitle}}</li>
  <li><strong>Withdrawn Amount:</strong> {{offerAmount}}</li>
</ul>
<p><a href="{{listingUrl}}" style="color: #0d9488;">View listing</a></p>`,
  },
  {
    key: 'wallet_credit',
    subject: '{{amount}} added to your Ad credit wallet – {{appName}}',
    body: `<p>Hi {{name}},</p>
<p>Your Ad credit wallet has been <strong>credited</strong>.</p>
<ul>
  <li><strong>Amount:</strong> {{amount}}</li>
  <li><strong>Source:</strong> {{reasonLabel}}</li>
  <li><strong>New balance:</strong> {{balance}}</li>
</ul>
<p>{{description}}</p>
<p><a href="{{walletUrl}}" style="color: #0d9488; font-weight: 600; text-decoration: underline;">View your wallet</a></p>`,
  },
  {
    key: 'wallet_debit',
    subject: '{{amount}} spent from your Ad credit wallet – {{appName}}',
    body: `<p>Hi {{name}},</p>
<p>Your Ad credit wallet has been <strong>debited</strong>.</p>
<ul>
  <li><strong>Amount:</strong> {{amount}}</li>
  <li><strong>For:</strong> {{reasonLabel}}</li>
  <li><strong>Remaining balance:</strong> {{balance}}</li>
</ul>
<p>{{description}}</p>
<p><a href="{{walletUrl}}" style="color: #0d9488; font-weight: 600; text-decoration: underline;">View your wallet</a></p>`,
  },
  {
    key: 'payment_activity',
    subject: 'Payment confirmed: {{amount}} – {{appName}}',
    body: `<p>Hi {{name}},</p>
<p>We received your payment.</p>
<ul>
  <li><strong>Amount:</strong> {{amount}}</li>
  <li><strong>Purpose:</strong> {{purposeLabel}}</li>
  <li><strong>Method:</strong> {{gatewayLabel}}</li>
  <li><strong>Reference:</strong> {{reference}}</li>
</ul>
<p><a href="{{paymentsUrl}}" style="color: #0d9488; font-weight: 600; text-decoration: underline;">View payment history</a></p>`,
  },
];

export const EMAIL_TEMPLATE_KEYS = EMAIL_TEMPLATE_SEEDS.map((t) => t.key);
