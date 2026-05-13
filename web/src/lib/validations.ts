import { z } from 'zod';
import { PROPERTY_TYPES, NIGERIAN_STATES, LISTING_TYPE, RENT_PERIOD } from './constants';
import { stripHtml } from './utils';

const propertyTypeSchema = z.enum(PROPERTY_TYPES as unknown as [string, ...string[]]);

export function resolveListingPropertyTypes(data: {
  propertyTypes?: string[];
  propertyType?: string;
}): { propertyType: string; propertyTypes: string[] } | null {
  const fromArr = data.propertyTypes?.filter(Boolean) ?? [];
  const fromSingle = data.propertyType ? [data.propertyType] : [];
  const raw = fromArr.length ? fromArr : fromSingle;
  const uniq = [...new Set(raw)].slice(0, 3);
  if (!uniq.length) return null;
  return { propertyType: uniq[0], propertyTypes: uniq };
}

/** MongoDB ObjectId: 24 hex characters */
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid ID format');

/** Blank or whitespace-only → undefined so optional email passes (plain `z.string().email().optional()` rejects ""). */
export const optionalListingAgentEmailSchema = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().email('Invalid email').optional()
);

/** Reusable string bounds to prevent oversized payloads */
const MAX_STRING = 10_000;
const MAX_EMAIL = 254;
const MAX_NAME = 200;
const MAX_MESSAGE = 5000;
const MAX_SUBJECT = 300;
/** Contact form message: keep short so validation error is reasonable */
export const MAX_CONTACT_MESSAGE = 1000;

export const registerSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(200).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  acceptTermsAndPrivacy: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms of Service and Privacy Policy to sign up.' }) }),
});

export const loginSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  password: z.string().min(1).max(500),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(500),
  password: z.string().min(8).max(200).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
});

const listingBaseSchema = z.object({
  title: z.string().min(5).max(200),
  description: z
    .string()
    .max(20000)
    .refine((s) => stripHtml(s).length >= 20, { message: 'Description must be at least 20 characters' }),
  listingType: z.enum(Object.values(LISTING_TYPE) as [string, ...string[]]),
  propertyType: propertyTypeSchema.optional(),
  propertyTypes: z.array(propertyTypeSchema).max(3).optional(),
  price: z.number().positive(),
  location: z.object({
    address: z.string().min(5),
    city: z.string().min(2),
    state: z.enum(NIGERIAN_STATES as unknown as [string, ...string[]]),
    suburb: z.string().optional(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  }),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  toilets: z.number().int().min(0).optional(),
  area: z.number().positive().optional(),
  amenities: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  contactSource: z.enum(['author', 'listing']).optional(),
  agentName: z.string().optional(),
  agentPhone: z.string().optional(),
  agentEmail: optionalListingAgentEmailSchema,
  rentPeriod: z.enum(Object.values(RENT_PERIOD) as [string, ...string[]]).optional(),
  leaseDuration: z.string().optional(),
  status: z.enum(['draft', 'active']).optional(),
  featured: z.boolean().optional(),
  highlighted: z.boolean().optional(),
  images: z.array(z.object({ public_id: z.string(), url: z.string() })).optional().default([]),
  videos: z.array(z.object({ public_id: z.string(), url: z.string() })).optional().default([]),
});

export const listingSchema = listingBaseSchema
  .superRefine((data, ctx) => {
    const resolved = resolveListingPropertyTypes(data);
    if (!resolved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one property type',
        path: ['propertyTypes'],
      });
      return;
    }
    if (resolved.propertyTypes.length > 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You can select up to 3 property types',
        path: ['propertyTypes'],
      });
    }
  })
  .refine((data) => {
    if (data.listingType === 'rent') return !!data.rentPeriod;
    return true;
  }, { message: 'Rent period is required for rental listings', path: ['rentPeriod'] })
  .refine((data) => {
    if (data.contactSource !== 'listing') return true;
    return !!(data.agentPhone?.trim() || data.agentEmail?.trim() || data.agentName?.trim());
  }, { message: 'Add listing contact details (phone/email/name) or switch contact to Author contact.', path: ['agentPhone'] });

/** Partial schema for PATCH/update - no refine */
const listingStatusUpdateSchema = z.enum([
  'draft',
  'active',
  'paused',
  'pending_approval',
  'closed',
]);

// PATCH/update is allowed to set more status values than create:
// users still should only use draft/active, but admins can set paused/closed too.
export const listingUpdateSchema = listingBaseSchema
  .partial()
  .omit({ status: true })
  .extend({
    status: listingStatusUpdateSchema.optional(),
    boostPackage: z.enum(['starter', 'pro', 'premium']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.propertyTypes !== undefined) {
      if (data.propertyTypes.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select at least one property type',
          path: ['propertyTypes'],
        });
      }
      if (data.propertyTypes.length > 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'You can select up to 3 property types',
          path: ['propertyTypes'],
        });
      }
    }
  });

export const claimSchema = z.object({
  listingId: objectIdSchema,
  proofUrls: z.array(z.string().url().max(2048)).min(1).max(10),
  message: z.string().max(500).optional(),
});

export const reviewSchema = z.object({
  listingId: objectIdSchema,
  revieweeId: objectIdSchema,
  rating: z.number().min(1).max(5),
  text: z.string().max(1000).optional(),
});

export const alertSchema = z.object({
  name: z.string().min(1).max(100),
  filters: z.object({
    listingType: z.enum(Object.values(LISTING_TYPE) as [string, ...string[]]).optional(),
    propertyType: z.string().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    suburb: z.string().optional(),
    bedrooms: z.number().min(0).optional(),
    bathrooms: z.number().min(0).optional(),
    rentPeriod: z.enum(['day', 'month', 'year']).optional(),
    tags: z.array(z.string()).optional(),
  }),
  notifyPush: z.boolean().default(true),
  notifyEmail: z.boolean().default(true),
});

// ---- Shared / security-focused schemas ----

export const contactFormSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  name: z.string().min(2).max(MAX_NAME).trim(),
  subject: z.string().min(2).max(MAX_SUBJECT).trim(),
  message: z.string().min(5).max(MAX_CONTACT_MESSAGE).trim(),
  captchaToken: z.string().max(10000).optional(),
});

export const verificationRequestSchema = z.object({
  type: z.enum(['verified_individual', 'registered_agent', 'registered_developer']),
  documentUrls: z
    .array(z.string().url().max(2048))
    .min(1, 'At least one document URL required')
    .max(5, 'Maximum 5 documents'),
  companyPosition: z.string().min(2).max(100).trim().optional(),
  message: z.string().max(500).trim().optional(),
}).refine(
  (data) => {
    if (data.type === 'registered_agent' || data.type === 'registered_developer') {
      return !!data.companyPosition && data.companyPosition.length >= 2;
    }
    return true;
  },
  { message: 'Position in company is required for Agent/Developer', path: ['companyPosition'] }
);

/** Nigerian phone: 234 + 10 digits. Accepts 08012345678, 8012345678, 2348012345678, +234 801 234 5678. */
export const phoneVerifySchema = z
  .object({
    phone: z.string().min(10).max(20).trim(),
  })
  .refine(
    (data) => {
      const digits = data.phone.replace(/\D/g, '');
      const normalized =
        digits.startsWith('234') ? digits.slice(0, 13) : digits.startsWith('0') ? '234' + digits.slice(1) : '234' + digits;
      return normalized.length === 13 && normalized.startsWith('234') && /^\d+$/.test(normalized);
    },
    { message: 'Enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)' }
  );

export const confirmPhoneSchema = z.object({
  code: z.string().min(4).max(8).regex(/^\d+$/, 'Code must be digits only'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
});

export const resendVerificationSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
});

export const savedListingSchema = z.object({
  listingId: objectIdSchema,
});

/** PATCH /api/me — only allow safe lengths and types */
export const meUpdateSchema = z.object({
  name: z.string().min(1).max(MAX_NAME).trim().optional(),
  firstName: z.string().max(100).trim().optional(),
  middleName: z.string().max(100).trim().optional(),
  lastName: z.string().max(100).trim().optional(),
  dateOfBirth: z.string().max(30).trim().optional(),
  address: z.string().max(500).trim().optional(),
  phone: z.string().max(20).trim().optional(),
  image: z.string().url().max(2048).optional(),
  companyPosition: z.string().max(100).trim().optional(),
}).strict();

export const livenessSchema = z.object({
  imageUrl: z.string().url().max(2048),
});

/** GET /api/listings — sanitize query params */
export const listingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  mine: z.enum(['0', '1']).optional(),
  listingType: z.string().max(50).optional(),
  propertyType: z.string().max(50).optional(),
  rentPeriod: z.string().max(20).optional(),
  state: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  suburb: z.string().max(100).optional(),
  minPrice: z.string().max(20).optional(),
  maxPrice: z.string().max(20).optional(),
  bedrooms: z.string().max(10).optional(),
  tags: z.string().max(500).optional(),
  q: z.string().max(200).optional(),
  featured: z.enum(['0', '1']).optional(),
  highlighted: z.enum(['0', '1']).optional(),
  random: z.enum(['0', '1']).optional(),
});

const offerAmountSchema = z.number().positive().max(1e15);

export const listingOfferCreateSchema = z.object({
  amount: offerAmountSchema,
  message: z.string().max(1000).optional(),
});

export const listingOfferPatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('counter'),
    amount: offerAmountSchema,
    message: z.string().max(1000).optional(),
  }),
  z.object({
    action: z.literal('maintain'),
    message: z.string().max(1000).optional(),
  }),
  z.object({ action: z.literal('withdraw') }),
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('decline') }),
]);
