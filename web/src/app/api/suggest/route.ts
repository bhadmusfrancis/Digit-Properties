import { NextResponse } from 'next/server';

type SuggestResult = {
  id: string;
  label: string;
};

function parseXmlSuggestions(xml: string): string[] {
  const out: string[] = [];
  const re = /<suggestion\s+data="([^"]+)"/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(xml)) !== null) {
    const v = (m[1] || '').trim();
    if (v) out.push(v);
    if (out.length >= 10) break;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 3) return NextResponse.json({ results: [] });

    const url = `https://www.google.com/complete/search?client=toolbar&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!res.ok) return NextResponse.json({ results: [] });
    const xml = await res.text();
    const results: SuggestResult[] = parseXmlSuggestions(xml).map((label, i) => ({
      id: `s-${i}`,
      label,
    }));
    return NextResponse.json({ results });
  } catch (e) {
    console.error('[suggest]', e);
    return NextResponse.json({ results: [] });
  }
}

