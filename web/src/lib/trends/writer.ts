import type { TrendCategory } from '@/lib/trends/sources';
import type { ResearchSnippet } from '@/lib/trends/research';
import { esc, extLink, figure, h2, h3, normalizeBodyHtml, p, ul } from '@/lib/trends/html';

export interface GeneratedTrendArticle {
  title: string;
  excerpt: string;
  content: string;
  sourceUrls: string[];
}

const ANGLES: Record<TrendCategory, string[]> = {
  'Market Trends': [
    'asking prices and absorption across major Nigerian cities',
    'rental demand versus new supply in prime and peri-urban belts',
    'what brokers are seeing in enquiry volumes this period',
  ],
  'Policy & Regulation': [
    'how new housing and land rules affect buyers and developers',
    'what agencies are signalling on mortgages, titles, and planning',
    'compliance checkpoints owners should not skip this quarter',
  ],
  'Lagos Focus': [
    'Lekki–Ajah, Ikeja, and the mainland corridors buyers keep asking about',
    'state housing and lands programmes that change deal timelines',
    'what a serious Lagos listing needs to stand out this week',
  ],
  'Abuja & FCT': [
    'Maitama, Wuse, Gwarinpa, and emerging district demand',
    'FCT land administration and development-control realities',
    'how Abuja investors are reading the current cycle',
  ],
  'Port Harcourt & Niger Delta': [
    'GRA, Peter Odili, and oil-city rental dynamics',
    'title risk and waterfront development in Rivers and neighbours',
    'what corporate tenants still pay for in Port Harcourt',
  ],
  'Events & Exhibitions': [
    'industry gatherings that actually move listings and partnerships',
    'what exhibitors are putting in front of buyers and financiers',
    'how owners can use the calendar without wasting a stand fee',
  ],
  'Industry Reports': [
    'the numbers behind Nigerian housing, office, and retail stock',
    'what the latest professional-body and consultant notes imply',
    'how to read a market report before you price a listing',
  ],
  'Investment & Finance': [
    'mortgage access, yield math, and naira-cost realities',
    'how developers and buyers are funding deals this cycle',
    'what a cautious investor checks before committing capital',
  ],
  'Housing & Affordability': [
    'the gap between advertised stock and what households can pay',
    'public programmes and private schemes aimed at mid-income buyers',
    'practical steps for first-time buyers who will not overstretch',
  ],
  'Land & Titling': [
    'C of O, governor’s consent, and survey plans without the folklore',
    'how buyers should verify land before paying a deposit',
    'what still goes wrong in peri-urban land transactions',
  ],
};

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dateLabel(d: Date): string {
  return d.toLocaleDateString('en-NG', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildFallbackArticle(
  category: TrendCategory,
  snippets: ResearchSnippet[],
  batchDate: Date,
  inBodyImage?: { url: string; caption: string }
): GeneratedTrendArticle {
  const seed = hashSeed(`${category}|${batchDate.toISOString().slice(0, 10)}`);
  const angle = pick(ANGLES[category], seed);
  const ok = snippets.filter((s) => s.ok && (s.title || s.description));
  const title = `${category}: ${angle.charAt(0).toUpperCase()}${angle.slice(1)}`;
  const excerpt = `A Digit Properties briefing on ${angle} — compiled from official agencies, professional bodies, and market sources for ${dateLabel(batchDate)}.`;

  const sourceLines = snippets.map((s) => {
    const note = s.ok && s.description ? ` — ${esc(s.description.slice(0, 180))}` : '';
    return `${extLink(s.url, s.name)}${note}`;
  });

  const takeaways = [
    'Treat public notices and professional-body updates as the first filter, then confirm on the ground.',
    'Price and tenure should match verified documents, not brochure language.',
    'Owners who publish clear photos, a mapped location, and a real asking price get faster, better enquiries.',
  ];

  const content = [
    p(
      `<strong>${esc(excerpt)}</strong> This note is written for buyers, tenants, and owners who need a usable read — not a press release.`
    ),
    inBodyImage ? figure(inBodyImage.url, inBodyImage.caption, title) : '',
    h2('What the sources are signalling'),
    p(
      ok.length
        ? `Public pages from ${ok.map((s) => esc(s.name)).join(', ')} currently emphasise the themes below. Where a page could not be fetched, we still list the official channel so you can check it directly.`
        : `Several official and market channels were reviewed for this edition. Some pages block automated fetches; the linked sources remain the places to verify the latest notice.`
    ),
    ...ok.slice(0, 3).map((s) => {
      const bits = [h3(s.name)];
      if (s.title) bits.push(p(`<em>${esc(s.title)}</em>`));
      if (s.description) bits.push(p(esc(s.description)));
      bits.push(p(`Read the source: ${extLink(s.url, s.name)}.`));
      return bits.join('\n');
    }),
    h2('What this means on the ground'),
    p(
      `For ${esc(category.toLowerCase())}, the practical question is not “is the market up or down?” — it is whether a specific plot, flat, or house can close with clean papers, a realistic price, and a counterpart who can complete. ${esc(angle.charAt(0).toUpperCase() + angle.slice(1))} should be read through that lens.`
    ),
    ul(takeaways.map(esc)),
    h2('If you have a property to sell or lease'),
    p(
      `Digit Properties does not charge a listing fee. If you own a house, land, or apartment, you can ${extLink('/listings/new', 'list it for free')} with photos, a map pin, and a clear asking price so serious buyers and tenants can find you.`
    ),
    h2('Sources'),
    ul(sourceLines),
    p(`<small>Editorial briefing for ${esc(dateLabel(batchDate))}. Always verify titles, consents, and agency notices before you pay.</small>`),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    title: title.slice(0, 140),
    excerpt: excerpt.slice(0, 240),
    content,
    sourceUrls: [...new Set(snippets.map((s) => s.url))],
  };
}

async function writeWithOpenAI(opts: {
  category: TrendCategory;
  researchBrief: string;
  snippets: ResearchSnippet[];
  batchDate: Date;
  siblingCategories: string[];
  inBodyImage?: { url: string; caption: string };
}): Promise<GeneratedTrendArticle | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const dateStr = dateLabel(opts.batchDate);
  const siblingNote =
    opts.siblingCategories.length > 0
      ? `\nOther categories already covered today — use a clearly different voice and headings: ${opts.siblingCategories.join(', ')}.`
      : '';

  const system = `You are a senior Nigerian real-estate editor writing for Digit Properties (digitproperties.com).
Write a unique, professional, publication-quality article. Output valid HTML only (no markdown): use <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>, <blockquote>, <figure>, <figcaption>, <img>, and <a href="..." target="_blank" rel="noopener noreferrer">.
Tone: informed, specific, Nigeria-first. Never generic "real estate is booming" filler.
Vary openings, headings, and vocabulary so posts in the same week do not feel templated.
Minimum 550 words. Include a Sources section with the provided URLs.
End with a short, natural note that owners can list a property for free at /listings/new (relative link).
Do not invent statistics, named officials, or unpublished circulars. If research is thin, say so and stay qualitative.`;

  const user = `Write today's ${opts.category} article for ${dateStr}.${siblingNote}

Research brief:
${opts.researchBrief}

Requirements:
- First line: TITLE: a specific, non-clickbait headline
- Second line: EXCERPT: under 220 characters
- Then the HTML body
- Topic must stay inside "${opts.category}"
- Beautiful formatting: short lead, 3–5 h2 sections, one list, optional blockquote
${opts.inBodyImage ? `- After the first paragraph include: <figure><img src="${opts.inBodyImage.url}" alt="${opts.inBodyImage.caption}" /><figcaption>${opts.inBodyImage.caption}</figcaption></figure>` : ''}
- Cite at least two source links from the brief
- Practical takeaways for buyers, tenants, or owners in Nigeria`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRENDS_MODEL || 'gpt-4o-mini',
        temperature: 0.85,
        top_p: 0.95,
        frequency_penalty: 0.55,
        presence_penalty: 0.35,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.warn('[trends/writer] OpenAI', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    const lines = raw.split('\n');
    let title = `${opts.category} briefing — ${dateStr}`;
    let excerpt = `Nigerian real estate notes on ${opts.category.toLowerCase()} for ${dateStr}.`;
    let bodyStart = 0;
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      if (/^TITLE:/i.test(lines[i])) {
        title = lines[i].replace(/^TITLE:\s*/i, '').trim().slice(0, 140);
        bodyStart = i + 1;
      } else if (/^EXCERPT:/i.test(lines[i])) {
        excerpt = lines[i].replace(/^EXCERPT:\s*/i, '').trim().slice(0, 240);
        bodyStart = i + 1;
      }
    }

    let content = normalizeBodyHtml(lines.slice(bodyStart).join('\n'));
    if (opts.inBodyImage && !content.includes(opts.inBodyImage.url)) {
      const firstP = content.indexOf('</p>');
      const insert = figure(opts.inBodyImage.url, opts.inBodyImage.caption, title);
      content =
        firstP >= 0 ? `${content.slice(0, firstP + 4)}\n${insert}${content.slice(firstP + 4)}` : `${insert}\n${content}`;
    }

    const sourceUrls = [
      ...opts.snippets.map((s) => s.url),
      ...[...content.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]),
    ];

    return {
      title,
      excerpt,
      content,
      sourceUrls: [...new Set(sourceUrls)],
    };
  } catch (e) {
    console.warn('[trends/writer]', (e as Error).message);
    return null;
  }
}

export async function writeTrendArticle(opts: {
  category: TrendCategory;
  snippets: ResearchSnippet[];
  researchBrief: string;
  batchDate: Date;
  siblingCategories?: string[];
  inBodyImage?: { url: string; caption: string };
}): Promise<GeneratedTrendArticle> {
  const ai = await writeWithOpenAI({
    category: opts.category,
    researchBrief: opts.researchBrief,
    snippets: opts.snippets,
    batchDate: opts.batchDate,
    siblingCategories: opts.siblingCategories ?? [],
    inBodyImage: opts.inBodyImage,
  });
  if (ai) return ai;
  return buildFallbackArticle(opts.category, opts.snippets, opts.batchDate, opts.inBodyImage);
}
