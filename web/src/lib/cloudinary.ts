import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function getCloudinaryUrl(publicId: string, options?: { width?: number; height?: number; crop?: string }) {
  const base = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`;
  if (!options) return `${base}/${publicId}`;
  const transforms: string[] = [];
  if (options.width) transforms.push(`w_${options.width}`);
  if (options.height) transforms.push(`h_${options.height}`);
  if (options.crop) transforms.push(`c_${options.crop}`);
  const t = transforms.length ? transforms.join(',') + '/' : '';
  return `${base}/${t}${publicId}`;
}

export default cloudinary;
