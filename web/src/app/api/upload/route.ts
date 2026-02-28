import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import cloudinary from '@/lib/cloudinary';
import { USER_ROLES } from '@/lib/constants';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB, SEO-friendly
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'listings';

    if (folder === 'trends' && session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: 'Use JPEG, PNG, WebP for images or MP4/WebM for video.' },
        { status: 400 }
      );
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: isVideo ? 'Video max 50MB.' : 'Image max 10MB (recommended 1200×630 or 1920×1080 for SEO).' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const resourceType: 'image' | 'video' = isVideo ? 'video' : 'image';

    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const options: {
        folder: string;
        resource_type: 'image' | 'video';
        transformation?: Array<{ width: number; crop: string; quality: string }>;
      } = {
        folder,
        resource_type: resourceType,
      };
      if (isImage) {
        options.transformation = [{ width: 1920, crop: 'limit', quality: 'auto' }];
      }
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (err, res) => {
          if (err) reject(err);
          else if (res) resolve({ secure_url: res.secure_url!, public_id: res.public_id! });
          else reject(new Error('Upload failed'));
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({
      url: result.secure_url,
      public_id: result.public_id,
      type: resourceType,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
