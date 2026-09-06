import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import cloudinary from '@/lib/cloudinary';
import { getSession } from '@/lib/get-session';
import { USER_ROLES } from '@/lib/constants';
import { buildCopyrightSafeTrendImagePrompt } from '@/lib/trends/copyright';

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const content = typeof body?.content === 'string' ? stripHtml(body.content) : '';
    if (title.length < 3 && !content) {
      return NextResponse.json({ error: 'Provide a title or content first.' }, { status: 400 });
    }

    const prompt = buildCopyrightSafeTrendImagePrompt(body ?? {});
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1536x1024',
    });

    const base64 = result.data?.[0]?.b64_json;
    if (!base64) {
      return NextResponse.json({ error: 'Image generation returned no image data.' }, { status: 502 });
    }

    const upload = await cloudinary.uploader.upload(`data:image/png;base64,${base64}`, {
      folder: 'trends',
      resource_type: 'image',
    });

    return NextResponse.json({
      url: upload.secure_url,
      public_id: upload.public_id,
      prompt,
      imageCredit: 'AI-generated image for Digit Properties editorial use',
      imageSourceName: 'Digit Properties',
      imageLicense: 'ai_generated',
    });
  } catch (e) {
    console.error('[admin/trends/generate-image]', e);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
