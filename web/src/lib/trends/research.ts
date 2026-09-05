import type { TrendSource } from '@/lib/trends/sources';

export interface ResearchSnippet {
  name: string;
  url: string;
  kind: TrendSource['kind'];
  title?: string;
  description?: string;
  imageUrl?: string;
  ok: boolean;
}

const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT =
  'DigitProperties-TrendsBot/1.0 (+https://www.digitproperties.com/trends; editorial research)';

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function extractMeta(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtml(m[1].trim());
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  return (
    extractMeta(html, 'og:title') ||
    extractMeta(html, 'twitter:title') ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  );
}

function extractDescription(html: string): string | undefined {
  return (
    extractMeta(html, 'og:description') ||
    extractMeta(html, 'twitter:description') ||
    extractMeta(html, 'description')
  );
}

function extractImage(html: string, pageUrl: string): string | undefined {
  const raw =
    extractMeta(html, 'og:image') ||
    extractMeta(html, 'og:image:url') ||
    extractMeta(html, 'twitter:image') ||
    extractMeta(html, 'twitter:image:src');
  if (!raw) return undefined;
  try {
    return new URL(raw, pageUrl).href;
  } catch {
    return raw.startsWith('http') ? raw : undefined;
  }
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-NG,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return null;
    const html = await res.text();
    if (html.length < 200) return null;
    return html.slice(0, 280_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function researchSources(sources: TrendSource[]): Promise<ResearchSnippet[]> {
  const results: ResearchSnippet[] = [];
  for (const source of sources) {
    const html = await fetchPage(source.url);
    if (!html) {
      results.push({ name: source.name, url: source.url, kind: source.kind, ok: false });
      continue;
    }
    results.push({
      name: source.name,
      url: source.url,
      kind: source.kind,
      title: extractTitle(html),
      description: extractDescription(html),
      imageUrl: extractImage(html, source.url),
      ok: true,
    });
  }
  return results;
}

export function formatResearchBrief(snippets: ResearchSnippet[]): string {
  return snippets
    .map((s) => {
      if (!s.ok) return `- ${s.name} (${s.url}): could not fetch`;
      const parts = [`- ${s.name} (${s.url})`];
      if (s.title) parts.push(`  Title: ${s.title}`);
      if (s.description) parts.push(`  Summary: ${s.description}`);
      if (s.imageUrl) parts.push(`  Image: ${s.imageUrl}`);
      return parts.join('\n');
    })
    .join('\n');
}
