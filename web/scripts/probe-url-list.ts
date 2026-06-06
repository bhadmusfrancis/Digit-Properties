/**
 * Probe a list of URLs (one per line) and summarize HTTP status codes.
 * Optionally write listing 404 segments to a backfill input file.
 *
 *   npx tsx scripts/probe-url-list.ts ../Search_console_data/gsc-indexed-urls.txt
 *   npx tsx scripts/probe-url-list.ts ../Search_console_data/gsc-indexed-urls.txt --write-404 ../Search_console_data/gsc-404-segments.txt
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--')) ?? '';
  const write404Idx = args.indexOf('--write-404');
  return {
    file,
    write404: write404Idx >= 0 ? args[write404Idx + 1] : undefined,
  };
}

async function probe(url: string): Promise<{ status: number; location?: string }> {
  try {
    const res = await fetch(url.trim(), { method: 'GET', redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location') ?? undefined };
  } catch {
    return { status: 0 };
  }
}

async function probeAll(urls: string[], concurrency = 25): Promise<Map<string, { status: number; location?: string }>> {
  const out = new Map<string, { status: number; location?: string }>();
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const url = urls[idx]!;
      out.set(url, await probe(url));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
  return out;
}

function extractListingSegment(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const m = u.pathname.match(/^\/listings\/([^/]+)\/?$/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const { file, write404 } = parseArgs();
  if (!file) {
    console.error('Usage: npx tsx scripts/probe-url-list.ts <url-list.txt> [--write-404 out.txt]');
    process.exit(1);
  }
  const abs = path.resolve(process.cwd(), file);
  if (!existsSync(abs)) {
    console.error(`Not found: ${abs}`);
    process.exit(1);
  }

  const urls = readFileSync(abs, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('http'));

  const probes = await probeAll(urls);
  const byStatus = new Map<number, string[]>();
  const listing404: string[] = [];

  for (const url of urls) {
    const { status, location } = probes.get(url) ?? { status: 0 };
    const bucket = byStatus.get(status) ?? [];
    bucket.push(url);
    byStatus.set(status, bucket);
    if (status === 404) {
      const seg = extractListingSegment(url);
      if (seg) listing404.push(seg);
    }
    if (status === 301 || status === 308) {
      void location;
    }
  }

  const summary = [...byStatus.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([status, list]) => ({ status, count: list.length, sample: list.slice(0, 5) }));

  if (write404 && listing404.length) {
    writeFileSync(path.resolve(process.cwd(), write404), listing404.join('\n') + '\n');
  }

  console.log(
    JSON.stringify(
      {
        total: urls.length,
        summary,
        listing404Count: listing404.length,
        listing404Sample: listing404.slice(0, 20),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
