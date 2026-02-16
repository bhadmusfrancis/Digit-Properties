import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import cloudinary from '@/lib/cloudinary';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'listings';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, or WebP.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ width: 1920, crop: 'limit', quality: 'auto' }],
        },
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
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
