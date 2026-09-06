import type { TrendImageLicense } from '@/models/Trend';
import type { ResearchSnippet } from '@/lib/trends/research';

export const TREND_IMAGE_LICENSES = [
  'unsplash',
  'ai_generated',
  'uploaded',
  'licensed_third_party',
  'source_editorial', // public-institution / official source imagery with attribution
] as const satisfies readonly TrendImageLicense[];

/**
 * Hosts / URL patterns for public institutions whose official photos, logos,
 * properties, and people-in-official-capacity may be used for news reporting
 * with attribution when not otherwise restricted.
 */
const PUBLIC_INSTITUTION_HOST_RE =
  /(^|\.)(gov\.ng|worldbank\.org|unhabitat\.org|un\.org|afdb\.org|shelterafrique\.org|cbn\.gov\.ng|nigerianstat\.gov\.ng|fmhud\.gov\.ng|fmbn\.gov\.ng|fcta\.gov\.ng|lagosstate\.gov\.ng|riversstate\.gov\.ng|nmrc\.com\.ng|fhfl\.com\.ng)(\.|$|\/)/i;

export function isPublicInstitutionUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '');
    return PUBLIC_INSTITUTION_HOST_RE.test(host) || PUBLIC_INSTITUTION_HOST_RE.test(url);
  } catch {
    return PUBLIC_INSTITUTION_HOST_RE.test(url);
  }
}

export function isPublicInstitutionSnippet(snippet: Pick<ResearchSnippet, 'url' | 'name'>): boolean {
  if (isPublicInstitutionUrl(snippet.url)) return true;
  const name = snippet.name?.toLowerCase() ?? '';
  return (
    /\b(federal|ministry|government|world bank|un-habitat|central bank|mortgage bank|lands bureau|state government)\b/i.test(
      name
    )
  );
}

/** Rank research snippets by how much usable content they contributed. */
export function contentRichness(snippet: ResearchSnippet): number {
  const textLen = (snippet.title?.length ?? 0) + (snippet.description?.length ?? 0);
  const okBonus = snippet.ok ? 5_000 : 0;
  const imageBonus = snippet.imageUrl ? 500 : 0;
  const kindBonus =
    snippet.kind === 'website' || snippet.kind === 'report'
      ? 200
      : snippet.kind === 'twitter'
        ? 100
        : 50;
  return okBonus + textLen + imageBonus + kindBonus;
}

export function snippetsByMajorSource(snippets: ResearchSnippet[]): ResearchSnippet[] {
  return [...snippets].sort((a, b) => contentRichness(b) - contentRichness(a));
}

/** Baseline rules for original AI compositions. */
export const COPYRIGHT_SAFE_IMAGE_RULES = [
  'Copyright-safe original composition only — invent the scene; do not copy or closely imitate any private news photograph, commercial stock photo, painting, or known artwork.',
  'Do not depict copyrighted characters, mascots, comic/anime figures, movie/TV scenes, or private brand merchandise.',
  'Do not include watermarks, signatures, QR codes, or UI chrome from third-party apps.',
  'Do not depict private individuals in a personal/private context.',
  'Do not mimic the distinctive style of a living artist or a protected franchise aesthetic.',
  'No arbitrary text overlays unrelated to an official institutional mark.',
].join(' ');

/** Extra allowance when the article is about a public institution. */
export const PUBLIC_INSTITUTION_VISUAL_ALLOWANCE = [
  'When the article is about a named public institution, you MAY depict that institution’s official buildings, properties, logos, and people in official public capacity if relevant.',
  'Do not invent false official seals; prefer generic institutional architecture and anonymous officials in formal attire when unsure.',
].join(' ');

export type TrendImagePromptInput = {
  title?: string;
  excerpt?: string;
  content?: string;
  category?: string;
  /**
   * Thematic cues distilled from news/OG imagery (setting, mood, subject types).
   */
  visualCues?: string;
  /** When true, AI may include the subject public institution’s official marks/people/properties. */
  allowPublicInstitutionVisuals?: boolean;
  publicInstitutionName?: string;
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
  const visualCues = typeof input.visualCues === 'string' ? input.visualCues.trim() : '';
  const allowPublic = Boolean(input.allowPublicInstitutionVisuals);
  const institution = input.publicInstitutionName?.trim();

  return [
    'Create a premium editorial hero image for a Nigerian real estate publication (Digit Properties).',
    'Style: photorealistic, clean, modern, publication-quality, natural lighting, high detail.',
    'Composition: wide landscape cover image, suitable as a featured blog banner.',
    COPYRIGHT_SAFE_IMAGE_RULES,
    allowPublic ? PUBLIC_INSTITUTION_VISUAL_ALLOWANCE : '',
    institution
      ? `Public institution subject (may appear via official buildings/logos/people in official capacity): ${institution}.`
      : '',
    'Use original imagery that matches the article topic and feels credible for a property publication.',
    visualCues
      ? [
          allowPublic
            ? 'Thematic inspiration cues (invent an ORIGINAL scene inspired by these cues; do not pixel-copy a specific private photo):'
            : 'Thematic inspiration cues (abstract only — invent a NEW original scene; do not recreate any specific private photograph):',
          truncate(visualCues, 900),
        ].join(' ')
      : '',
    category ? `Category: ${category}.` : '',
    title ? `Post title (topic cue only — do not render as text unless it is an official institutional mark): ${title}.` : '',
    excerpt ? `Excerpt (topic cue only): ${truncate(excerpt, 300)}.` : '',
    content ? `Article content summary (topic cue only): ${truncate(content, 1800)}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * System/user guidance for vision: turn a news/OG image into thematic cues.
 */
export const SOURCE_IMAGE_CUE_VISION_PROMPT = [
  'You help create copyright-safe editorial image briefs for a Nigerian real estate publication.',
  'Describe thematic cues from the reference image: setting, lighting, mood, architecture, and subject types.',
  'If the image clearly shows a public institution (government agency, central bank, World Bank, etc.), you MAY name that institution and note official logos, buildings, or people in official capacity.',
  'Do NOT name private celebrities or private brands unrelated to a public institution.',
  'Do NOT describe composition so precisely that another model could recreate a private commercial photo.',
  'Reply in 2-4 short sentences of plain thematic cues only.',
].join(' ');

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

  if (license === 'source_editorial') {
    if (!sourceName) {
      return 'Public-institution / official source images require a source name.';
    }
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
      return 'Public-institution / official source images require a source URL.';
    }
    // Auto-attributed official sources do not need a separate rights checkbox when URL is a known public host.
    if (!isPublicInstitutionUrl(sourceUrl) && !input.imageRightsConfirmed) {
      return 'Confirm you have permission before using a non–public-institution source image.';
    }
  }

  if (license === 'licensed_third_party') {
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
    case 'source_editorial':
      return 'Official / public-institution image used with attribution for news reporting.';
    default:
      return null;
  }
}
