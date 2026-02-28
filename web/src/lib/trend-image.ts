import cloudinary from '@/lib/cloudinary';

/** Build a numeric seed from id/title/slug for deterministic Picsum image. */
export function buildImageSeed(id: string, title: string, slug: string): string {
  const s = `${id}-${slug || title}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return String(Math.abs(h));
}

/** Get Picsum image URL for a trend (deterministic from seed). */
export function getPicsumImageUrl(seed: string, width = 1200, height = 630): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

/**
 * Upload Picsum image (by seed) to Cloudinary trends folder. Returns the Cloudinary URL.
 */
export function uploadPicsumToCloudinary(id: string, title: string, slug: string): Promise<string> {
  const seed = buildImageSeed(id, title, slug);
  const imageUrl = getPicsumImageUrl(seed);
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      imageUrl,
      { folder: 'trends', resource_type: 'image' },
      (err, res) => {
        if (err) reject(err);
        else if (res?.secure_url) resolve(res.secure_url);
        else reject(new Error('Cloudinary upload failed'));
      }
    );
  });
}
