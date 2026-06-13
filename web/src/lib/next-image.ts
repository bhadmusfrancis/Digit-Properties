import { isDefaultListingImageUrl } from '@/lib/listing-default-image';

const CLOUDINARY_HOST = 'res.cloudinary.com';

/**
 * Sources that should skip Vercel Image Optimization (per Vercel cost guidance):
 * Cloudinary CDN (already transformed), local/static assets, and SVG placeholders.
 */
export function shouldBypassVercelImageOptimization(src: string): boolean {
  const url = (src || '').trim();
  if (!url) return true;
  if (url.includes(CLOUDINARY_HOST)) return true;
  if (url.endsWith('.svg')) return true;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  if (isDefaultListingImageUrl(url)) return true;
  return false;
}

/**
 * When bypassing Vercel, request a right-sized Cloudinary delivery URL instead of the original upload.
 */
export function withCloudinaryDeliveryWidth(src: string, width: number): string {
  const url = (src || '').trim();
  if (!url.includes(CLOUDINARY_HOST) || !url.includes('/image/upload/')) return url;
  if (/\/image\/upload\/(?:v\d+\/)?[^/]+,/.test(url)) return url;
  const w = Math.max(1, Math.round(width));
  const transforms = `c_limit,w_${w},q_auto,f_auto`;
  return url.replace(/\/image\/upload\/(?:v\d+\/)?/, (prefix) => `${prefix}${transforms}/`);
}

/** Props for next/image when showing listing or ad media. */
export function listingImageProps(src: string, deliveryWidth: number) {
  const bypass = shouldBypassVercelImageOptimization(src);
  return {
    src: bypass ? withCloudinaryDeliveryWidth(src, deliveryWidth) : src,
    unoptimized: bypass,
  };
}
