import { z } from 'zod';
import { PROPERTY_TYPES, NIGERIAN_STATES, LISTING_TYPE, RENT_PERIOD } from './constants';

/** MongoDB ObjectId: 24 hex characters */
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid ID format');

/** Reusable string bounds to prevent oversized payloads */
const MAX_STRING = 10_000;
const MAX_EMAIL = 254;
const MAX_NAME = 200;
const MAX_MESSAGE = 5000;
const MAX_SUBJECT = 300;

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
  description: z.string().min(20).max(5000),
  listingType: z.enum(Object.values(LISTING_TYPE) as [string, ...string[]]),
  propertyType: z.enum(PROPERTY_TYPES as unknown as [string, ...string[]]),
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
  agentName: z.string().optional(),
  agentPhone: z.string().optional(),
  agentEmail: z.string().email().optional().or(z.literal('')),
  rentPeriod: z.enum(Object.values(RENT_PERIOD) as [string, ...string[]]).optional(),
  leaseDuration: z.string().optional(),
  status: z.enum(['draft', 'active']).optional(),
  featured: z.boolean().optional(),
  highlighted: z.boolean().optional(),
  images: z.array(z.object({ public_id: z.string(), url: z.string() })).optional().default([]),
  videos: z.array(z.object({ public_id: z.string(), url: z.string() })).optional().default([]),
});

export const listingSchema = listingBaseSchema.refine((data) => {
  if (data.listingType === 'rent') return !!data.rentPeriod;
  return true;
}, { message: 'Rent period is required for rental listings', path: ['rentPeriod'] });

/** Partial schema for PATCH/update - no refine */
export const listingUpdateSchema = listingBaseSchema.partial();

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
    listingType: z.string().optional(),
    propertyType: z.string().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    bedrooms: z.number().optional(),
    bathrooms: z.number().optional(),
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
  message: z.string().min(5).max(MAX_MESSAGE).trim(),
  captchaToken: z.string().max(2000).optional(),
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

export const phoneVerifySchema = z.object({
  phone: z.string().min(10).max(20).trim(),
});

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
