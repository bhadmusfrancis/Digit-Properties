import { z } from 'zod';
import { PROPERTY_TYPES, NIGERIAN_STATES, LISTING_TYPE, RENT_PERIOD } from './constants';

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
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
  listingId: z.string(),
  proofUrls: z.array(z.string().url()).min(1),
  message: z.string().max(500).optional(),
});

export const reviewSchema = z.object({
  listingId: z.string(),
  revieweeId: z.string(),
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
