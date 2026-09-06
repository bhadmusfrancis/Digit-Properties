import type { TrendImageLicense } from '@/models/Trend';

export const TREND_IMAGE_LICENSES = [
  'unsplash',
  'ai_generated',
  'uploaded',
  'licensed_third_party',
  'source_editorial', // legacy; prefer licensed_third_party for new posts
] as const satisfies readonly TrendImageLicense[];

/** Rules appended to every trend AI image prompt. */
export const COPYRIGHT_SAFE_IMAGE_RULES = [
  'Copyright-safe original composition only — invent the scene; do not copy or closely imitate any real photograph, news image, stock photo, painting, or known artwork.',
  'Do not depict copyrighted characters, mascots, comic/anime figures, movie/TV scenes, or brand merchandise.',
  'Do not include logos, trademarks, brand names, watermarks, signatures, QR codes, UI chrome, or readable product packaging.',
  'Do not depict recognizable living celebrities, politicians, or private individuals; use anonymous figures only if people appear.',
  'Do not mimic the distinctive style of a living artist or a protected franchise aesthetic.',
  'No text overlays of any kind.',
].join(' ');

export type TrendImagePromptInput = {
  title?: string;
  excerpt?: string;
  content?: string;
  category?: string;
};

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max).trim()}...`;
}

/** Build an OpenAI image prompt that stays within copyright-safe bounds. */
export function buildCopyrightSafeTrendImagePrompt(input: TrendImagePromptInput): string {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const excerpt = typeof input.excerpt === 'string' ? input.excerpt.trim() : '';
  const content = typeof input.content === 'string' ? stripHtml(input.content) : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';

  return [
    'Create a premium editorial hero image for a Nigerian real estate publication (Digit Properties).',
    'Style: photorealistic, clean, modern, publication-quality, natural lighting, high detail.',
    'Composition: wide landscape cover image, suitable as a featured blog banner.',
    COPYRIGHT_SAFE_IMAGE_RULES,
    'Use original imagery that matches the article topic and feels credible for a property publication.',
    category ? `Category: ${category}.` : '',
    title ? `Post title (topic cue only — do not render as text): ${title}.` : '',
    excerpt ? `Excerpt (topic cue only): ${truncate(excerpt, 300)}.` : '',
    content ? `Article content summary (topic cue only): ${truncate(content, 1800)}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export type TrendImageAttributionInput = {
  imageUrl?: string | null;
  imageCredit?: string | null;
  imageSourceName?: string | null;
  imageSourceUrl?: string | null;
  imageLicense?: string | null;
  /** Required for uploaded / licensed third-party images. */
  imageRightsConfirmed?: boolean;
};

/**
 * Validate hero-image provenance before create/update.
 * Returns an error message, or null when OK.
 */
export function validateTrendImageAttribution(input: TrendImageAttributionInput): string | null {
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';
  if (!imageUrl) return null;

  const credit = typeof input.imageCredit === 'string' ? input.imageCredit.trim() : '';
  if (!credit) {
    return 'Photo credit is required when a featured image is set.';
  }

  const license = typeof input.imageLicense === 'string' ? input.imageLicense.trim() : '';
  if (!license || !(TREND_IMAGE_LICENSES as readonly string[]).includes(license)) {
    return 'Select a valid image license type (Unsplash, AI-generated, uploaded, or licensed third-party).';
  }

  const sourceUrl = typeof input.imageSourceUrl === 'string' ? input.imageSourceUrl.trim() : '';
  const sourceName = typeof input.imageSourceName === 'string' ? input.imageSourceName.trim() : '';

  if (license === 'unsplash') {
    if (!sourceUrl || !/^https?:\/\/(www\.)?unsplash\.com\//i.test(sourceUrl)) {
      return 'Unsplash images require a source URL linking to unsplash.com (photo page).';
    }
  }

  if (license === 'licensed_third_party' || license === 'source_editorial') {
    if (!sourceName) {
      return 'Licensed third-party images require a source name.';
    }
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
      return 'Licensed third-party images require a source URL proving permission or license terms.';
    }
    if (!input.imageRightsConfirmed) {
      return 'Confirm you have a license or written permission before using a third-party image.';
    }
  }

  if (license === 'uploaded') {
    if (!input.imageRightsConfirmed) {
      return 'Confirm Digit Properties owns or is licensed to publish this uploaded image.';
    }
  }

  return null;
}

/** Public-facing license footnote (no overclaiming fair dealing / fair use). */
export function trendImageLicenseFootnote(license?: string | null): string | null {
  switch (license) {
    case 'unsplash':
      return 'Unsplash License — free to use with credit.';
    case 'ai_generated':
      return 'Original AI-generated asset created for Digit Properties.';
    case 'licensed_third_party':
      return 'Used under license or permission from the rights holder.';
    case 'uploaded':
      return 'Published with rights confirmed by Digit Properties editorial.';
    // Legacy value from older posts that rehosted source OG images
    case 'source_editorial':
      return 'Third-party image — verify ongoing rights before reuse.';
    default:
      return null;
  }
}
