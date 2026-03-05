import cloudinary from '@/lib/cloudinary';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/** Upload a single ID image (File/Blob) to Cloudinary verification folder. Returns secure_url. */
export async function uploadIdImage(file: File | Blob): Promise<string> {
  const f = file as File;
  const type = f.type ?? (file as Blob).type ?? '';
  if (!ALLOWED.includes(type)) {
    throw new Error('ID image must be JPEG, PNG or WebP.');
  }
  const size = f.size ?? (file as Blob).size ?? 0;
  if (size > MAX_SIZE) {
    throw new Error('ID image max 10MB.');
  }
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'verification',
        resource_type: 'image',
        transformation: [{ width: 1920, crop: 'limit', quality: 'auto' }],
      },
      (err, res) => {
        if (err) reject(err);
        else if (res?.secure_url) resolve(res.secure_url);
        else reject(new Error('Upload failed'));
      }
    ).end(buffer);
  });
}
