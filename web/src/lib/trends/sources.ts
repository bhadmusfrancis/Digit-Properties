import { TREND_CATEGORIES } from '@/lib/constants';

export type TrendCategory = (typeof TREND_CATEGORIES)[number];

export type SourceKind = 'website' | 'twitter' | 'facebook' | 'instagram' | 'report';

export interface TrendSource {
  name: string;
  url: string;
  kind: SourceKind;
  categories: TrendCategory[];
}

/** Official and widely cited Nigerian real-estate, government, NGO, and market sources. */
export const TREND_SOURCES: TrendSource[] = [
  {
    name: 'Federal Ministry of Housing and Urban Development',
    url: 'https://fmhud.gov.ng',
    kind: 'website',
    categories: ['Policy & Regulation', 'Housing & Affordability', 'Land & Titling', 'Industry Reports'],
  },
  {
    name: 'Federal Mortgage Bank of Nigeria',
    url: 'https://www.fmbn.gov.ng',
    kind: 'website',
    categories: ['Housing & Affordability', 'Investment & Finance', 'Policy & Regulation'],
  },
  {
    name: 'Nigeria Mortgage Refinance Company',
    url: 'https://nmrc.com.ng',
    kind: 'website',
    categories: ['Investment & Finance', 'Housing & Affordability', 'Industry Reports'],
  },
  {
    name: 'Family Homes Funds',
    url: 'https://fhfl.com.ng',
    kind: 'website',
    categories: ['Housing & Affordability', 'Investment & Finance', 'Policy & Regulation'],
  },
  {
    name: 'National Bureau of Statistics',
    url: 'https://www.nigerianstat.gov.ng',
    kind: 'website',
    categories: ['Market Trends', 'Industry Reports', 'Housing & Affordability', 'Investment & Finance'],
  },
  {
    name: 'Central Bank of Nigeria',
    url: 'https://www.cbn.gov.ng',
    kind: 'website',
    categories: ['Investment & Finance', 'Policy & Regulation', 'Market Trends'],
  },
  {
    name: 'Lagos State Government',
    url: 'https://lagosstate.gov.ng',
    kind: 'website',
    categories: ['Lagos Focus', 'Policy & Regulation', 'Land & Titling', 'Events & Exhibitions'],
  },
  {
    name: 'Lagos State Ministry of Housing',
    url: 'https://lagosstate.gov.ng',
    kind: 'website',
    categories: ['Lagos Focus', 'Housing & Affordability', 'Policy & Regulation'],
  },
  {
    name: 'Lagos State Lands Bureau',
    url: 'https://landonline.lagosstate.gov.ng',
    kind: 'website',
    categories: ['Lagos Focus', 'Land & Titling', 'Policy & Regulation'],
  },
  {
    name: 'Federal Capital Territory Administration',
    url: 'https://www.fcta.gov.ng',
    kind: 'website',
    categories: ['Abuja & FCT', 'Policy & Regulation', 'Land & Titling'],
  },
  {
    name: 'NIESV',
    url: 'https://niesv.org.ng',
    kind: 'website',
    categories: ['Industry Reports', 'Market Trends', 'Events & Exhibitions', 'Land & Titling'],
  },
  {
    name: 'REDAN',
    url: 'https://www.redanonline.org',
    kind: 'website',
    categories: ['Industry Reports', 'Events & Exhibitions', 'Housing & Affordability', 'Market Trends'],
  },
  {
    name: 'Estate Intel',
    url: 'https://estateintel.com',
    kind: 'website',
    categories: ['Market Trends', 'Industry Reports', 'Investment & Finance', 'Lagos Focus', 'Abuja & FCT'],
  },
  {
    name: 'Nigeria Property Centre Insights',
    url: 'https://nigeriapropertycentre.com/blog',
    kind: 'website',
    categories: ['Market Trends', 'Lagos Focus', 'Abuja & FCT', 'Port Harcourt & Niger Delta', 'Investment & Finance'],
  },
  {
    name: 'PropertyPro Blog',
    url: 'https://www.propertypro.ng/blog',
    kind: 'website',
    categories: ['Market Trends', 'Lagos Focus', 'Housing & Affordability', 'Investment & Finance'],
  },
  {
    name: 'UPDC',
    url: 'https://www.updcplc.com',
    kind: 'website',
    categories: ['Industry Reports', 'Investment & Finance', 'Lagos Focus', 'Abuja & FCT'],
  },
  {
    name: 'Mixta Africa',
    url: 'https://mixtafrica.com',
    kind: 'website',
    categories: ['Housing & Affordability', 'Investment & Finance', 'Lagos Focus'],
  },
  {
    name: 'Broll Nigeria',
    url: 'https://www.broll.com/locations/nigeria',
    kind: 'website',
    categories: ['Market Trends', 'Industry Reports', 'Investment & Finance'],
  },
  {
    name: 'Knight Frank Research',
    url: 'https://www.knightfrank.com/research',
    kind: 'report',
    categories: ['Industry Reports', 'Market Trends', 'Investment & Finance'],
  },
  {
    name: 'PwC Nigeria',
    url: 'https://www.pwc.com/ng/en.html',
    kind: 'report',
    categories: ['Industry Reports', 'Investment & Finance', 'Policy & Regulation'],
  },
  {
    name: 'World Bank Nigeria',
    url: 'https://www.worldbank.org/en/country/nigeria',
    kind: 'website',
    categories: ['Housing & Affordability', 'Policy & Regulation', 'Industry Reports'],
  },
  {
    name: 'UN-Habitat',
    url: 'https://unhabitat.org',
    kind: 'website',
    categories: ['Housing & Affordability', 'Policy & Regulation', 'Industry Reports'],
  },
  {
    name: 'Habitat for Humanity',
    url: 'https://www.habitat.org',
    kind: 'website',
    categories: ['Housing & Affordability', 'Policy & Regulation'],
  },
  {
    name: 'Shelter Afrique',
    url: 'https://www.shelterafrique.org',
    kind: 'website',
    categories: ['Investment & Finance', 'Housing & Affordability', 'Industry Reports'],
  },
  {
    name: 'African Development Bank Nigeria',
    url: 'https://www.afdb.org/en/countries/west-africa/nigeria',
    kind: 'website',
    categories: ['Investment & Finance', 'Industry Reports', 'Housing & Affordability'],
  },
  {
    name: 'Northcourt Real Estate',
    url: 'https://www.northcourtrealestate.com',
    kind: 'website',
    categories: ['Abuja & FCT', 'Market Trends', 'Investment & Finance'],
  },
  {
    name: 'Rivers State Government',
    url: 'https://www.riversstate.gov.ng',
    kind: 'website',
    categories: ['Port Harcourt & Niger Delta', 'Policy & Regulation', 'Land & Titling'],
  },
  {
    name: 'Lagos State on X',
    url: 'https://x.com/followlasg',
    kind: 'twitter',
    categories: ['Lagos Focus', 'Policy & Regulation', 'Events & Exhibitions'],
  },
  {
    name: 'CBN on X',
    url: 'https://x.com/cenbank',
    kind: 'twitter',
    categories: ['Investment & Finance', 'Policy & Regulation', 'Market Trends'],
  },
  {
    name: 'NBS on X',
    url: 'https://x.com/NBS_Nigeria',
    kind: 'twitter',
    categories: ['Market Trends', 'Industry Reports', 'Housing & Affordability'],
  },
  {
    name: 'FMBN on X',
    url: 'https://x.com/FMBNigeria',
    kind: 'twitter',
    categories: ['Housing & Affordability', 'Investment & Finance'],
  },
  {
    name: 'Lagos State on Facebook',
    url: 'https://www.facebook.com/lagosstategovernment',
    kind: 'facebook',
    categories: ['Lagos Focus', 'Events & Exhibitions', 'Policy & Regulation'],
  },
  {
    name: 'Lagos State on Instagram',
    url: 'https://www.instagram.com/lagos_state',
    kind: 'instagram',
    categories: ['Lagos Focus', 'Events & Exhibitions'],
  },
];

export const DAILY_TREND_COUNT = 5;

export function sourcesForCategory(category: TrendCategory): TrendSource[] {
  return TREND_SOURCES.filter((s) => s.categories.includes(category));
}

export function pickSourcesForCategory(category: TrendCategory, count = 4): TrendSource[] {
  const pool = sourcesForCategory(category);
  const websites = pool.filter((s) => s.kind === 'website' || s.kind === 'report');
  const social = pool.filter((s) => s.kind !== 'website' && s.kind !== 'report');
  const shuffledWeb = shuffle(websites);
  const shuffledSocial = shuffle(social);
  const picked: TrendSource[] = [];
  for (const s of shuffledWeb) {
    if (picked.length >= count - 1) break;
    picked.push(s);
  }
  if (shuffledSocial[0] && picked.length < count) picked.push(shuffledSocial[0]);
  while (picked.length < Math.min(count, pool.length)) {
    const next = pool.find((s) => !picked.includes(s));
    if (!next) break;
    picked.push(next);
  }
  return picked;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
