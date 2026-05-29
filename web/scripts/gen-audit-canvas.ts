/**
 * One-off: turn .audit-report.json into a Cursor canvas for reviewing
 * suggested property-type corrections. Not part of the app.
 *
 *   npx tsx scripts/gen-audit-canvas.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const CANVAS_PATH =
  'C:\\Users\\User\\.cursor\\projects\\c-Users-User-Desktop-Digit-Properties\\canvases\\listing-type-audit.canvas.tsx';

const SAFE = new Set([
  'industrial -> warehouse',
  'industrial -> factory',
  'warehouse -> factory',
  'industrial -> apartment',
]);
const REVIEW = new Set([
  'commercial -> land',
  'office -> land',
  'warehouse -> land',
  'mini_flat -> land',
  'duplex -> land',
  'house -> land',
  'factory -> land',
  'bungalow -> land',
  'mixed_use -> land',
  'hotel -> land',
  'apartment -> land',
  'commercial -> house',
  'commercial -> duplex',
  'commercial -> mini_flat',
  'commercial -> apartment',
  'commercial -> shop',
  'house -> commercial',
  'event_center -> industrial',
  'commercial -> industrial',
]);

function tierOf(pair: string): 'safe' | 'review' | 'risky' {
  if (SAFE.has(pair)) return 'safe';
  if (REVIEW.has(pair)) return 'review';
  return 'risky';
}

function clean(s: string, n = 175): string {
  const t = String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > n ? t.slice(0, n) + '\u2026' : t;
}

type RawRow = {
  id: string;
  slug?: string;
  current: string;
  suggested: string;
  title?: string;
  newTitle: string;
  listingType?: string;
  snippet: string;
};

const report = JSON.parse(
  readFileSync(path.resolve('.audit-report.json'), 'utf8')
) as { scanned: number; mismatches: number; rows: RawRow[] };

const tierRank = { safe: 0, review: 1, risky: 2 } as const;

const rows = report.rows
  .map((r) => ({
    pair: r.current + ' -> ' + r.suggested,
    tier: tierOf(r.current + ' -> ' + r.suggested),
    current: r.current,
    suggested: r.suggested,
    title: r.title ?? '',
    newTitle: r.newTitle,
    slug: r.slug ?? '',
    listingType: r.listingType ?? '',
    snippet: clean(r.snippet),
  }))
  .sort((a, b) => {
    if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
    if (a.pair !== b.pair) return a.pair.localeCompare(b.pair);
    return 0;
  });

const prelude =
  "import {\n" +
  "  useHostTheme,\n" +
  "  useCanvasState,\n" +
  "  Stack,\n" +
  "  Row,\n" +
  "  H1,\n" +
  "  H2,\n" +
  "  Text,\n" +
  "  Pill,\n" +
  "  Table,\n" +
  "  Stat,\n" +
  "  Grid,\n" +
  "  Callout,\n" +
  "  Code,\n" +
  "} from 'cursor/canvas';\n\n";

const dataBlock =
  'const SCANNED = ' + report.scanned + ';\n' +
  'const ROWS = ' + JSON.stringify(rows) + ';\n\n';

const component = [
  "const TIER_LABEL = { safe: 'Recommended', review: 'Likely \\u2014 glance', risky: 'Manual only' };",
  "const TIER_TONE = { safe: 'success', review: 'warning', risky: 'danger' };",
  "const SITE = 'https://www.digitproperties.com/listings/';",
  "",
  "export default function ListingTypeAudit() {",
  "  const theme = useHostTheme();",
  "  const [tier, setTier] = useCanvasState('tier', 'all');",
  "  const [pair, setPair] = useCanvasState('pair', '');",
  "",
  "  const counts = { all: ROWS.length, safe: 0, review: 0, risky: 0 };",
  "  for (const r of ROWS) counts[r.tier] = counts[r.tier] + 1;",
  "",
  "  let shown = tier === 'all' ? ROWS : ROWS.filter((r) => r.tier === tier);",
  "  if (pair) shown = shown.filter((r) => r.pair === pair);",
  "",
  "  const pairsInView = [];",
  "  const seen = {};",
  "  for (const r of (tier === 'all' ? ROWS : ROWS.filter((x) => x.tier === tier))) {",
  "    if (!seen[r.pair]) { seen[r.pair] = true; pairsInView.push(r.pair); }",
  "  }",
  "",
  "  const headers = ['Change', 'Listing title (now \\u2192 proposed)', 'Why the classifier says so (post excerpt)'];",
  "  const tableRows = shown.map((r) => [",
  "    <Stack gap={2}>",
  "      <Row gap={6} align='center'>",
  "        <Code>{r.current}</Code>",
  "        <Text tone='tertiary' as='span'>{'\\u2192'}</Text>",
  "        <Code>{r.suggested}</Code>",
  "      </Row>",
  "      <Pill size='sm' tone={TIER_TONE[r.tier]}>{TIER_LABEL[r.tier]}</Pill>",
  "    </Stack>,",
  "    <Stack gap={2}>",
  "      <Text size='small' tone='secondary'>{r.title}</Text>",
  "      <Text size='small' weight='semibold'>{'\\u2192 ' + r.newTitle}</Text>",
  "      <Text size='small'>{'[open listing](' + SITE + r.slug + ')'}</Text>",
  "    </Stack>,",
  "    <Text size='small' tone='secondary'>{r.snippet}</Text>,",
  "  ]);",
  "  const rowTone = shown.map((r) => (r.tier === 'safe' ? 'success' : r.tier === 'risky' ? 'danger' : 'warning'));",
  "",
  "  const tierPills = ['all', 'safe', 'review', 'risky'];",
  "",
  "  return (",
  "    <Stack gap={16} style={{ padding: 4 }}>",
  "      <Stack gap={4}>",
  "        <H1>Listing property-type audit</H1>",
  "        <Text tone='secondary'>",
  "          Listings whose stored type disagrees with the post text, after the classifier fixes.",
  "          Filling stations, eateries and tank farms are already corrected. Review and apply the rest by target type with",
  "          {' '}<Code>scripts/audit-listing-property-types.ts --type=&lt;slug&gt; --apply</Code>.",
  "        </Text>",
  "      </Stack>",
  "",
  "      <Grid columns={4} gap={12}>",
  "        <Stat value={SCANNED} label='Listings scanned' />",
  "        <Stat value={counts.all} label='Disagreements' tone='info' />",
  "        <Stat value={counts.safe} label='Recommended' tone='success' />",
  "        <Stat value={counts.risky} label='Manual only' tone='danger' />",
  "      </Grid>",
  "",
  "      <Callout tone='warning' title='Read before applying'>",
  "        <Text size='small'>",
  "          Recommended changes are unambiguous (e.g. warehouses tagged industrial). Likely changes are usually right but worth a glance.",
  "          Manual-only changes are multi-property briefs, location names (e.g. \"Orchid Hotel Road\"), or subjective residential swaps \\u2014 do not bulk-apply these.",
  "        </Text>",
  "      </Callout>",
  "",
  "      <Stack gap={8}>",
  "        <Row gap={6} align='center' wrap>",
  "          <Text size='small' tone='tertiary'>Tier:</Text>",
  "          {tierPills.map((t) => (",
  "            <Pill key={t} active={tier === t} tone={t === 'all' ? 'neutral' : TIER_TONE[t]}",
  "              onClick={() => { setTier(t); setPair(''); }}>",
  "              {(t === 'all' ? 'All' : TIER_LABEL[t]) + ' (' + counts[t] + ')'}",
  "            </Pill>",
  "          ))}",
  "        </Row>",
  "        <Row gap={6} align='center' wrap>",
  "          <Text size='small' tone='tertiary'>Type change:</Text>",
  "          <Pill active={pair === ''} onClick={() => setPair('')}>All</Pill>",
  "          {pairsInView.map((p) => (",
  "            <Pill key={p} active={pair === p} onClick={() => setPair(p)}>{p}</Pill>",
  "          ))}",
  "        </Row>",
  "      </Stack>",
  "",
  "      <H2>{shown.length + ' listing' + (shown.length === 1 ? '' : 's')}</H2>",
  "      <Table headers={headers} rows={tableRows} rowTone={rowTone} striped stickyHeader",
  "        columnAlign={['left', 'left', 'left']} />",
  "    </Stack>",
  "  );",
  "}",
  "",
].join('\n');

writeFileSync(CANVAS_PATH, prelude + dataBlock + component);
console.log('wrote ' + CANVAS_PATH + ' with ' + rows.length + ' rows');
