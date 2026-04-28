import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import cloudinary from '@/lib/cloudinary';
import { getSession } from '@/lib/get-session';
import { USER_ROLES } from '@/lib/constants';

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max).trim()}...`;
}

function buildPrompt(input: { title?: string; excerpt?: string; content?: string; category?: string }) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const excerpt = typeof input.excerpt === 'string' ? input.excerpt.trim() : '';
  const content = typeof input.content === 'string' ? stripHtml(input.content) : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';

  return [
    'Create a premium editorial hero image for a Nigerian real estate blog post.',
    'Style: photorealistic, clean, modern, publication-quality, natural lighting, high detail.',
    'Composition: wide landscape cover image, suitable as a featured blog banner.',
    'Avoid text overlays, logos, watermarks, UI elements, collages, or split screens.',
    'Use imagery that matches the article topic and feels credible for a property publication.',
    category ? `Category: ${category}.` : '',
    title ? `Post title: ${title}.` : '',
    excerpt ? `Excerpt: ${truncate(excerpt, 300)}.` : '',
    content ? `Article content summary: ${truncate(content, 1800)}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
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

    const prompt = buildPrompt(body ?? {});
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
    });
  } catch (e) {
    console.error('[admin/trends/generate-image]', e);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
