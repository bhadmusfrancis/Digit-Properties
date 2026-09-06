import type { TrendCategory } from '@/lib/trends/sources';
import type { ResearchSnippet } from '@/lib/trends/research';
import { esc, extLink, h2, h3, normalizeBodyHtml, p, stripInlineImages, ul, blockquote } from '@/lib/trends/html';

export interface GeneratedTrendArticle {
  title: string;
  excerpt: string;
  content: string;
  sourceUrls: string[];
}

/** Phrases that make Trends titles/excerpts feel templated — banned in generation + stripped in post-process. */
export const TREND_BANNED_TITLE_PHRASES = [
  'navigating',
  'explore',
  'exploring',
  'understanding',
  'unveiling',
  'unlocking',
  'delving',
  'a deep dive',
  'deep dive',
  'must-attend',
  'must know',
  'everything you need',
  'comprehensive guide',
  'ultimate guide',
  'a guide for',
  'key insights',
  'key takeaways',
  'insights from',
  'opportunities and challenges',
  'challenges and opportunities',
  'real estate landscape',
  'property landscape',
  'market landscape',
  'mortgage landscape',
  'housing landscape',
  'briefing',
  'in this article',
  'in today’s',
  "in today's",
];

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

const FALLBACK_TITLES: Record<TrendCategory, string[]> = {
  'Market Trends': [
    'What asking prices are really doing in Nigeria’s big cities',
    'Where rental enquiry is holding up — and where it is not',
    'Broker desks on demand: the quiet signals buyers miss',
  ],
  'Policy & Regulation': [
    'New housing rules that change how deals close',
    'Mortgage and land notices owners should actually read',
    'Compliance checks before you pay for a plot or flat',
  ],
  'Lagos Focus': [
    'Lekki, Ikeja, mainland: where Lagos buyers keep circling',
    'State housing moves that slow — or speed — a Lagos sale',
    'How a Lagos listing earns serious calls this week',
  ],
  'Abuja & FCT': [
    'Maitama to Gwarinpa: reading Abuja demand without the hype',
    'FCT paper trails that still trip buyers up',
    'How careful capital is sizing Abuja right now',
  ],
  'Port Harcourt & Niger Delta': [
    'GRA and waterfront stock: what still rents in Port Harcourt',
    'Title risk on Rivers deals — the checks that matter',
    'Corporate tenants and the PH rents they will still pay',
  ],
  'Events & Exhibitions': [
    'Industry meets worth the stand fee this season',
    'What exhibitors put in front of serious buyers',
    'Using the property calendar without wasting a week',
  ],
  'Industry Reports': [
    'Reading the latest housing and office numbers properly',
    'What consultant notes imply for your asking price',
    'How to use a market report before you list or bid',
  ],
  'Investment & Finance': [
    'Mortgage access and naira costs — the practical math',
    'How developers and buyers are funding deals this cycle',
    'Checks a cautious investor runs before committing',
  ],
  'Housing & Affordability': [
    'Advertised stock vs what households can actually pay',
    'Public and private schemes aimed at mid-income buyers',
    'First-time buyers: stretch less, verify more',
  ],
  'Land & Titling': [
    'C of O and consent without the folklore',
    'Verify the land before the deposit leaves your account',
    'Where peri-urban land deals still go wrong',
  ],
};

const FALLBACK_EXCERPTS: Record<TrendCategory, string[]> = {
  'Market Trends': [
    'A straight read on prices, absorption, and enquiry — written for people closing deals, not collecting jargon.',
    'What brokers and asking prices are signalling across Nigeria’s main property belts.',
    'Demand is uneven. Here is how to read it without a recycled market slogan.',
  ],
  'Policy & Regulation': [
    'Agency notices and housing rules that change paperwork, timelines, and who can complete.',
    'A buyer-and-owner cut of mortgage and land policy — specific, not ceremonial.',
    'The compliance steps that still stop closings when people skip them.',
  ],
  'Lagos Focus': [
    'Corridor-level notes for Lagos buyers and landlords who need usable detail.',
    'How state programmes and local demand shape what closes in Lagos.',
    'Practical Lagos listing and buying cues without the recycled “landscape” copy.',
  ],
  'Abuja & FCT': [
    'District demand and FCT process realities for people actually buying or leasing.',
    'A grounded Abuja note: papers, pricing, and where capital is careful.',
    'What still matters in the capital market when the headlines get loud.',
  ],
  'Port Harcourt & Niger Delta': [
    'Rental and title realities in Port Harcourt for owners and corporate tenants.',
    'Oil-city demand, waterfront risk, and the checks that keep deals honest.',
    'A PH-focused read that stays on process and price, not filler.',
  ],
  'Events & Exhibitions': [
    'Which gatherings are worth time and stand cost for Nigerian property people.',
    'How to use the industry calendar without collecting empty brochures.',
    'Meetings that move introductions — and which ones usually do not.',
  ],
  'Industry Reports': [
    'How to pull usable signals from the latest housing and commercial notes.',
    'Numbers and professional-body updates, translated for listing and bid decisions.',
    'A report-reading habit that helps you price without parroting the PDF.',
  ],
  'Investment & Finance': [
    'Funding, yield, and mortgage access in plain Nigerian deal language.',
    'What cautious capital checks before it commits to land or housing.',
    'Cost of money and structure — the parts that decide if a deal survives.',
  ],
  'Housing & Affordability': [
    'The gap between brochure prices and household budgets, with workable next steps.',
    'Schemes and stock that mid-income buyers can actually approach.',
    'Affordability without slogans: what stretches, and what to verify first.',
  ],
  'Land & Titling': [
    'Title, consent, and survey checks before money moves.',
    'A field-minded note on land paper — what to request and what to doubt.',
    'Peri-urban and urban land: the failure points buyers keep repeating.',
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

function normalizeComparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip banned stock phrasing and dated edition language from titles/excerpts. */
export function sanitizeTrendCopy(text: string, maxLen: number): string {
  let out = text.replace(/\s+/g, ' ').trim();
  out = out
    .replace(/\s*[—–-]\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b.*$/i, '')
    .replace(/\bfor\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b[^.]*/gi, '')
    .replace(/\b\d{1,2}\s+\w+\s+\d{4}\b/g, '')
    .replace(/^(navigating|exploring|understanding|unveiling|unlocking)\s+/i, '')
    .replace(/\b(real estate|property|market|mortgage|housing)\s+landscape\b/gi, 'market')
    .replace(/\bopportunities and challenges\b/gi, 'trade-offs')
    .replace(/\bchallenges and opportunities\b/gi, 'trade-offs')
    .replace(/\bkey insights\b/gi, 'notes')
    .replace(/\binsights from\b/gi, 'from')
    .replace(/\ba must-attend\b/gi, 'worth considering')
    .replace(/\bcomprehensive guide\b/gi, 'practical note')
    .replace(/\bultimate guide\b/gi, 'practical note')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Drop leading category-label style "Market Trends:" prefixes that feel automated.
  out = out.replace(
    /^(Market Trends|Policy & Regulation|Lagos Focus|Abuja & FCT|Port Harcourt & Niger Delta|Events & Exhibitions|Industry Reports|Investment & Finance|Housing & Affordability|Land & Titling)\s*:\s*/i,
    ''
  );

  if (out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out.slice(0, maxLen).trim();
}

function sharesTooManyWords(a: string, b: string): boolean {
  const wa = new Set(normalizeComparable(a).split(' ').filter((w) => w.length > 3));
  const wb = normalizeComparable(b).split(' ').filter((w) => w.length > 3);
  if (wa.size === 0 || wb.length === 0) return false;
  let overlap = 0;
  for (const w of wb) if (wa.has(w)) overlap += 1;
  return overlap / Math.min(wa.size, wb.length) >= 0.55;
}

function containsBannedPhrase(text: string): boolean {
  const n = normalizeComparable(text);
  return TREND_BANNED_TITLE_PHRASES.some((phrase) => n.includes(normalizeComparable(phrase)));
}

function buildFallbackArticle(
  category: TrendCategory,
  snippets: ResearchSnippet[],
  batchDate: Date,
  avoidTitles: string[] = []
): GeneratedTrendArticle {
  const seed = hashSeed(`${category}|${batchDate.toISOString().slice(0, 10)}|${avoidTitles.join('|')}`);
  const angle = pick(ANGLES[category], seed);
  const titlePool = FALLBACK_TITLES[category];
  const excerptPool = FALLBACK_EXCERPTS[category];
  let title = pick(titlePool, seed);
  let excerpt = pick(excerptPool, seed + 17);
  for (let i = 0; i < titlePool.length; i++) {
    const candidate = titlePool[(seed + i) % titlePool.length];
    if (!avoidTitles.some((t) => sharesTooManyWords(t, candidate))) {
      title = candidate;
      break;
    }
  }

  const ok = snippets.filter((s) => s.ok && (s.title || s.description));

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
      `<strong>${esc(excerpt)}</strong> Written for buyers, tenants, and owners who need a usable read — not a press release.`
    ),
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
    blockquote('Always verify titles, consents, and agency notices before you pay.'),
    ul(takeaways.map(esc)),
    h2('If you have a property to sell or lease'),
    p(
      `Digit Properties does not charge a listing fee. If you own a house, land, or apartment, you can ${extLink('/listings/new', 'list it for free')} with photos, a map pin, and a clear asking price so serious buyers and tenants can find you.`
    ),
    h2('Sources'),
    ul(sourceLines),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    title: sanitizeTrendCopy(title, 140),
    excerpt: sanitizeTrendCopy(excerpt, 240),
    content: stripInlineImages(content),
    sourceUrls: [...new Set(snippets.map((s) => s.url))],
  };
}

async function writeWithOpenAI(opts: {
  category: TrendCategory;
  researchBrief: string;
  snippets: ResearchSnippet[];
  batchDate: Date;
  siblingCategories: string[];
  recentTitles: string[];
  recentExcerpts: string[];
}): Promise<GeneratedTrendArticle | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const siblingNote =
    opts.siblingCategories.length > 0
      ? `\nOther categories already covered today — use a clearly different voice and headings: ${opts.siblingCategories.join(', ')}.`
      : '';

  const avoidTitles = opts.recentTitles.slice(0, 20);
  const avoidExcerpts = opts.recentExcerpts.slice(0, 20);
  const avoidBlock = [
    avoidTitles.length ? `Recent titles to avoid echoing (do not reuse their openers, structure, or repeated words):\n- ${avoidTitles.join('\n- ')}` : '',
    avoidExcerpts.length
      ? `Recent excerpts to avoid echoing:\n- ${avoidExcerpts.join('\n- ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const banned = TREND_BANNED_TITLE_PHRASES.join(', ');

  const system = `You are a senior Nigerian real-estate editor writing for Digit Properties (digitproperties.com).
Return a single JSON object only (no markdown fences) with keys: title, excerpt, content.

Title rules (strict):
- Human, specific, conversational headline (max 110 chars). Sounds like a sharp editor, not SEO spam.
- No dates, weekdays, or "edition" language.
- Do NOT start with or include these stock words/phrases: ${banned}.
- Do not reuse the same opener pattern as recent titles (especially "Navigating…", "Exploring…", "Understanding…", "…Landscape", "Insights from…").
- Prefer concrete places, documents, prices, agencies, or buyer/owner actions over abstract "landscape/insights" wording.
- Never prefix with the category name.

Excerpt rules (strict):
- Under 200 characters. One or two natural sentences.
- Human tone; no brochure filler; no date/weekday language.
- Do not repeat the title verbatim.
- Avoid the same banned stock phrases and do not mirror recent excerpts.

Content rules:
- Publication-quality HTML using only <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>, <blockquote>, and <a href="..." target="_blank" rel="noopener noreferrer">.
- Do NOT use <img>, <figure>, <figcaption>, <title>, <h1>, or markdown.
- Tone: informed, specific, Nigeria-first, warm and direct — like explaining to a careful buyer over coffee.
- Vary openings, headings, and vocabulary so posts in the same week do not feel templated.
- Minimum 550 words. Include a Sources section with the provided URLs as HTML links.
- End with a short, natural note that owners can list a property for free at /listings/new (relative link).
- Do not invent statistics, named officials, or unpublished circulars. If research is thin, say so and stay qualitative.

Copyright and originality (mandatory):
- Write original analysis in your own words. Do not copy or closely paraphrase substantial passages from source pages.
- Short quoted excerpts (a sentence or two) are allowed only when clearly marked with quotation marks or <blockquote> and attributed with a link to the source.
- Never reproduce paywalled, report, or press-release text at length. Summarise facts; do not scrape prose.`;

  const user = `Write a ${opts.category} article as JSON.${siblingNote}

Research brief:
${opts.researchBrief}

${avoidBlock}

Requirements:
- Topic must stay inside "${opts.category}"
- Beautiful formatting: short lead <p>, 3–5 <h2> sections, one <ul>, one <blockquote>
- Cite at least two source links from the brief inside the HTML
- Practical takeaways for buyers, tenants, or owners in Nigeria
- No images in the HTML body
- Original wording only; attribute any short quotes; do not paste source copy
- Title and excerpt must feel freshly written and distinct from the avoid list`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRENDS_MODEL || 'gpt-4o-mini',
        temperature: 0.95,
        top_p: 0.92,
        frequency_penalty: 0.8,
        presence_penalty: 0.55,
        response_format: { type: 'json_object' },
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

    let parsed: { title?: string; excerpt?: string; content?: string };
    try {
      parsed = JSON.parse(raw) as { title?: string; excerpt?: string; content?: string };
    } catch {
      console.warn('[trends/writer] invalid JSON from model');
      return null;
    }

    let title = sanitizeTrendCopy(String(parsed.title || ''), 140);
    let excerpt = sanitizeTrendCopy(String(parsed.excerpt || ''), 240);

    if (!title || containsBannedPhrase(title) || avoidTitles.some((t) => sharesTooManyWords(t, title))) {
      title = sanitizeTrendCopy(pick(FALLBACK_TITLES[opts.category], hashSeed(title + opts.category)), 140);
    }
    if (!excerpt || containsBannedPhrase(excerpt) || sharesTooManyWords(title, excerpt)) {
      excerpt = sanitizeTrendCopy(pick(FALLBACK_EXCERPTS[opts.category], hashSeed(excerpt + title)), 240);
    }

    const content = stripInlineImages(normalizeBodyHtml(String(parsed.content || '')));
    if (!content || content.replace(/<[^>]+>/g, '').trim().length < 120) {
      return null;
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
  recentTitles?: string[];
  recentExcerpts?: string[];
}): Promise<GeneratedTrendArticle> {
  const ai = await writeWithOpenAI({
    category: opts.category,
    researchBrief: opts.researchBrief,
    snippets: opts.snippets,
    batchDate: opts.batchDate,
    siblingCategories: opts.siblingCategories ?? [],
    recentTitles: opts.recentTitles ?? [],
    recentExcerpts: opts.recentExcerpts ?? [],
  });
  if (ai) return ai;
  return buildFallbackArticle(opts.category, opts.snippets, opts.batchDate, opts.recentTitles ?? []);
}
