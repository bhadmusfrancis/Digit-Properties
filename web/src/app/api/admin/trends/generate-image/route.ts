import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import cloudinary from '@/lib/cloudinary';
import { getSession } from '@/lib/get-session';
import { USER_ROLES } from '@/lib/constants';
import {
  SOURCE_IMAGE_CUE_VISION_PROMPT,
  buildCopyrightSafeTrendImagePrompt,
} from '@/lib/trends/copyright';

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function visualCuesFromReference(
  client: OpenAI,
  imageUrl: string
): Promise<string | undefined> {
  try {
    const result = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 220,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SOURCE_IMAGE_CUE_VISION_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract abstract thematic cues from this reference image for an original editorial illustration.',
            },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
    });
    return result.choices[0]?.message?.content?.trim() || undefined;
  } catch (e) {
    console.warn('[admin/trends/generate-image] cue vision failed', (e as Error).message);
    return undefined;
  }
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
    const referenceImageUrl =
      typeof body?.referenceImageUrl === 'string' ? body.referenceImageUrl.trim() : '';
    if (title.length < 3 && !content) {
      return NextResponse.json({ error: 'Provide a title or content first.' }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let visualCues: string | undefined;
    if (referenceImageUrl && /^https?:\/\//i.test(referenceImageUrl)) {
      visualCues = await visualCuesFromReference(client, referenceImageUrl);
    }

    const prompt = buildCopyrightSafeTrendImagePrompt({
      ...(body ?? {}),
      visualCues,
    });
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
      usedReferenceCues: Boolean(visualCues),
      imageCredit: 'AI-generated image for Digit Properties editorial use',
      imageSourceName: 'Digit Properties',
      imageLicense: 'ai_generated',
    });
  } catch (e) {
    console.error('[admin/trends/generate-image]', e);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
