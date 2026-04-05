import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import cloudinary from '@/lib/cloudinary';
import { USER_ROLES } from '@/lib/constants';
import { classifyListingUploadParts } from '@/lib/listing-media-accept';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

/** Returns a short-lived Cloudinary upload signature (browser uploads go straight to Cloudinary). */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const b = body as {
      folder?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    };

    const folder = typeof b.folder === 'string' && b.folder.trim() ? b.folder.trim() : 'listings';
    const fileName = typeof b.fileName === 'string' ? b.fileName : '';
    const mimeType = typeof b.mimeType === 'string' ? b.mimeType : '';
    const fileSize = typeof b.fileSize === 'number' ? b.fileSize : NaN;

    if (!fileName || !Number.isFinite(fileSize) || fileSize < 0) {
      return NextResponse.json({ error: 'fileName and fileSize are required' }, { status: 400 });
    }

    if (folder === 'trends' && session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const kind = classifyListingUploadParts(fileName, mimeType, fileSize);
    if (!kind) {
      return NextResponse.json(
        { error: 'Use JPEG, PNG, WebP for images or common video formats (MP4, WebM, MOV, 3GP, etc.).' },
        { status: 400 }
      );
    }

    const isVideo = kind === 'video';
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (fileSize > maxSize) {
      return NextResponse.json(
        { error: isVideo ? 'Video max 50MB.' : 'Image max 10MB (recommended 1200×630 or 1920×1080 for SEO).' },
        { status: 400 }
      );
    }

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!apiSecret || !apiKey || !cloudName) {
      console.error('Cloudinary env not configured');
      return NextResponse.json({ error: 'Upload not configured' }, { status: 500 });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = {
      timestamp,
      folder,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return NextResponse.json({
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder,
      resourceType: kind,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
