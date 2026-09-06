import OpenAI from 'openai';
import cloudinary from '@/lib/cloudinary';
import type { TrendCategory } from '@/lib/trends/sources';
import { buildCopyrightSafeTrendImagePrompt } from '@/lib/trends/copyright';

export type TrendImageLicense = 'unsplash' | 'ai_generated' | 'uploaded' | 'licensed_third_party' | 'source_editorial';

export type TrendImageAttribution = {
  imageUrl?: string;
  fromSource: boolean;
  imageSourceName?: string;
  imageSourceUrl?: string;
  imageCredit?: string;
  imageLicense?: TrendImageLicense;
};

/** Unsplash License (https://unsplash.com/license) — free to use with credit. */
const CATEGORY_STOCK: Record<
  TrendCategory,
  { url: string; credit: string; photoUrl: string }
> = {
  'Market Trends': {
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
    credit: 'Photo by Sean Pollock on Unsplash',
    photoUrl: 'https://unsplash.com/photos/building-under-blue-sky-PhYq704ffdA',
  },
  'Policy & Regulation': {
    url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1600&q=80',
    credit: 'Photo by Tingey Injury Law Firm on Unsplash',
    photoUrl: 'https://unsplash.com/photos/brown-wooden-gavel-on-brown-wooden-table-DZpc4UY8Gkc',
  },
  'Lagos Focus': {
    url: 'https://images.unsplash.com/photo-1618828665011-0abd973f7bb8?auto=format&fit=crop&w=1600&q=80',
    credit: 'Photo on Unsplash',
    photoUrl: 'https://unsplash.com/photos/1618828665011-0abd973f7bb8',
  },
  'Abuja & FCT': {
    url: 'https://images.unsplash.com/photo-1611348524140-53c9a25263d6?auto=format&fit=crop&w=1600&q=80',
    credit: 'Photo on Unsplash',
    photoUrl: 'https://unsplash.com/photos/1611348524140-53c9a25263d6',
  },
  'Port Harcourt & Niger Delta': {
    url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
    credit: 'Photo on Unsplash',
    photoUrl: 'https://unsplash.com/photos/1500530855697-b586d89ba3ee',
  },
  'Events & Exhibitions': {
    url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80',
    credit: 'Photo by Product School on Unsplash',
    photoUrl: 'https://unsplash.com/photos/people-sitting-on-chair-in-front-of-computer-nWvOTe7ZZKQ',
  },
  'Industry Reports': {
    url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80',
    credit: 'Photo by Scott Graham on Unsplash',
    photoUrl: 'https://unsplash.com/photos/person-holding-pencil-near-laptop-computer-5fNmWej4tAA',
  },
  'Investment & Finance': {
    url: 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?auto=format&fit=crop&w=1600&q=80',
    credit: 'Photo by Towfiqu barbhuiya on Unsplash',
    photoUrl: 'https://unsplash.com/photos/1560520653-9e0e4c89eb11',
  },
  'Housing & Affordability': {
    url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80',
    credit: 'Photo by Tierra Mallorca on Unsplash',
    photoUrl: 'https://unsplash.com/photos/white-and-brown-concrete-building-61QvN5bX1ZI',
  },
  'Land & Titling': {
    url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
    credit: 'Photo by Dominik Vanyi on Unsplash',
    photoUrl: 'https://unsplash.com/photos/green-grass-field-during-sunset-Hb6-hkdHUss',
  },
};

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
    const prompt = buildCopyrightSafeTrendImagePrompt({
      title: input.title,
      excerpt: input.excerpt,
      category: input.category,
    });
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

/**
 * Resolve hero image using only copyright-clear sources:
 * 1. Original AI-generated image (copyright-safe prompt)
 * 2. Category Unsplash stock (Unsplash License + photographer credit)
 *
 * Third-party news/OG images are never rehosted — attribution alone is not a license.
 */
export async function resolveTrendImage(opts: {
  title: string;
  excerpt: string;
  category: TrendCategory;
  /** Kept for call-site compatibility; source OG images are intentionally unused. */
  snippets?: unknown;
}): Promise<TrendImageAttribution> {
  const generated = await generateEditorialImage(opts);
  if (generated) {
    return {
      imageUrl: generated,
      fromSource: false,
      imageSourceName: 'Digit Properties',
      imageCredit: 'AI-generated image for Digit Properties editorial use',
      imageLicense: 'ai_generated',
    };
  }

  const stock = CATEGORY_STOCK[opts.category];
  const uploadedStock = await uploadRemote(stock.url);
  return {
    imageUrl: uploadedStock ?? stock.url,
    fromSource: false,
    imageSourceName: 'Unsplash',
    imageSourceUrl: stock.photoUrl,
    imageCredit: `${stock.credit} · Unsplash License`,
    imageLicense: 'unsplash',
  };
}

/** Short credit line for captions / footer. */
export function formatImageCreditLine(attrs: {
  imageCredit?: string | null;
  imageSourceName?: string | null;
  imageSourceUrl?: string | null;
  imageLicense?: string | null;
}): string | null {
  const credit = attrs.imageCredit?.trim();
  if (credit) {
    if (attrs.imageSourceUrl) return `${credit} (${attrs.imageSourceUrl})`;
    return credit;
  }
  if (attrs.imageSourceName && attrs.imageSourceUrl) {
    return `Image: ${attrs.imageSourceName} — ${attrs.imageSourceUrl}`;
  }
  return null;
}
