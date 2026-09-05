import OpenAI from 'openai';
import cloudinary from '@/lib/cloudinary';
import type { TrendCategory } from '@/lib/trends/sources';
import type { ResearchSnippet } from '@/lib/trends/research';

const CATEGORY_STOCK: Record<TrendCategory, string> = {
  'Market Trends':
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
  'Policy & Regulation':
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1600&q=80',
  'Lagos Focus':
    'https://images.unsplash.com/photo-1618828665011-0abd973f7bb8?auto=format&fit=crop&w=1600&q=80',
  'Abuja & FCT':
    'https://images.unsplash.com/photo-1611348524140-53c9a25263d6?auto=format&fit=crop&w=1600&q=80',
  'Port Harcourt & Niger Delta':
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
  'Events & Exhibitions':
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80',
  'Industry Reports':
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80',
  'Investment & Finance':
    'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?auto=format&fit=crop&w=1600&q=80',
  'Housing & Affordability':
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80',
  'Land & Titling':
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
};

function isUsableImageUrl(url?: string): url is string {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (url.includes('placeholder') || url.includes('default-avatar')) return false;
  return true;
}

async function uploadRemote(url: string): Promise<string | undefined> {
  try {
    const upload = await cloudinary.uploader.upload(url, {
      folder: 'trends',
      resource_type: 'image',
      timeout: 20_000,
    });
    return upload.secure_url;
  } catch {
    return undefined;
  }
}

async function generateEditorialImage(input: {
  title: string;
  excerpt: string;
  category: TrendCategory;
}): Promise<string | undefined> {
  if (!process.env.OPENAI_API_KEY) return undefined;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = [
      'Create a premium editorial hero image for a Nigerian real estate publication.',
      'Style: photorealistic, clean, modern, natural lighting, high detail, landscape banner.',
      'Avoid text overlays, logos, watermarks, UI, collages, or split screens.',
      `Category: ${input.category}.`,
      `Post title: ${input.title}.`,
      `Excerpt: ${input.excerpt.slice(0, 280)}.`,
    ].join('\n');
    const result = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1536x1024',
    });
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) return undefined;
    const upload = await cloudinary.uploader.upload(`data:image/png;base64,${base64}`, {
      folder: 'trends',
      resource_type: 'image',
    });
    return upload.secure_url;
  } catch (e) {
    console.warn('[trends/images] generate failed', (e as Error).message);
    return undefined;
  }
}

export async function resolveTrendImage(opts: {
  title: string;
  excerpt: string;
  category: TrendCategory;
  snippets: ResearchSnippet[];
}): Promise<{ imageUrl?: string; fromSource: boolean }> {
  for (const snippet of opts.snippets) {
    if (!isUsableImageUrl(snippet.imageUrl)) continue;
    const uploaded = await uploadRemote(snippet.imageUrl);
    if (uploaded) return { imageUrl: uploaded, fromSource: true };
  }

  const generated = await generateEditorialImage(opts);
  if (generated) return { imageUrl: generated, fromSource: false };

  const stock = CATEGORY_STOCK[opts.category];
  const uploadedStock = await uploadRemote(stock);
  return { imageUrl: uploadedStock ?? stock, fromSource: false };
}

export function firstSourceImage(snippets: ResearchSnippet[]): string | undefined {
  return snippets.find((s) => isUsableImageUrl(s.imageUrl))?.imageUrl;
}
