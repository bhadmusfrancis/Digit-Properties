/**
 * Field-weighted keyword relevance for listing search.
 *
 * MongoDB's `$text` score is only available when the query uses the text index
 * (`sort=relevance`), so keyword searches coming from other sorts — and from the
 * mobile app, which never sends a sort — had no relevance signal at all. This
 * builds a `_kwScore` that works on every code path: a title or location match
 * outranks a passing mention in the description, and a listing matching more of
 * the typed words outranks one matching fewer.
 */

export const LISTING_KEYWORD_SCORE_KEY = '_kwScore';

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/** Words that carry no ranking signal in property queries. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'around',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'near',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

export function escapeRegexTerm(value: string): string {
  return value.replace(REGEX_SPECIALS, '\\$&');
}

/** Distinct, meaningful words from a raw query, capped so the pipeline stays small. */
export function extractKeywordTerms(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
  return Array.from(new Set(words)).slice(0, 8);
}

/** Fields a single query word may match. Ranking, not matching, decides order. */
const KEYWORD_MATCH_FIELDS = [
  'title',
  'description',
  'location.suburb',
  'location.city',
  'location.state',
  'location.address',
] as const;

function fieldMatchClauses(regex: RegExp): Record<string, unknown>[] {
  return [
    ...KEYWORD_MATCH_FIELDS.map((field) => ({ [field]: regex })),
    { tags: { $in: [regex] } },
    { amenities: { $in: [regex] } },
  ];
}

/**
 * Match filter for a keyword query: the whole phrase in any field, or the query
 * words present somewhere.
 *
 * `all` (default) requires every meaningful word, which is far more precise than
 * the text index's any-word behaviour — "land for sale ibeju" narrows from ~3.5k
 * matches to ~50. `any` is the fallback for when `all` finds nothing.
 */
export function buildKeywordFilter(
  query: string | undefined,
  mode: 'all' | 'any' = 'all'
): Record<string, unknown> | null {
  const phrase = query?.trim();
  if (!phrase) return null;

  const branches: Record<string, unknown>[] = [
    { $or: fieldMatchClauses(new RegExp(escapeRegexTerm(phrase), 'i')) },
  ];

  const terms = extractKeywordTerms(phrase);
  if (terms.length > 0) {
    const perTerm = terms.map((term) => ({
      $or: fieldMatchClauses(new RegExp(escapeRegexTerm(term), 'i')),
    }));
    branches.push(mode === 'all' ? { $and: perTerm } : { $or: perTerm });
  }

  return branches.length === 1 ? branches[0] : { $or: branches };
}

/** True when an `any`-word retry could widen results beyond the strict filter. */
export function keywordSupportsAnyFallback(query: string | undefined): boolean {
  return extractKeywordTerms(query?.trim() || '').length > 1;
}

function joinArrayField(field: string): Record<string, unknown> {
  return {
    $reduce: {
      input: { $ifNull: [field, []] },
      initialValue: '',
      in: { $concat: ['$$value', ' ', { $toString: { $ifNull: ['$$this', ''] } }] },
    },
  };
}

function concatExpr(parts: unknown[]): Record<string, unknown> {
  return { $concat: parts };
}

const TITLE_EXPR: Record<string, unknown> = { $ifNull: ['$title', ''] };
const DESCRIPTION_EXPR: Record<string, unknown> = { $ifNull: ['$description', ''] };
const TAGS_EXPR = joinArrayField('$tags');
const LOCATION_EXPR = concatExpr([
  { $ifNull: ['$location.suburb', ''] },
  ' ',
  { $ifNull: ['$location.city', ''] },
  ' ',
  { $ifNull: ['$location.state', ''] },
  ' ',
  { $ifNull: ['$location.address', ''] },
]);
const CATEGORY_EXPR = concatExpr([
  { $ifNull: ['$propertyType', ''] },
  ' ',
  joinArrayField('$propertyTypes'),
  ' ',
  joinArrayField('$amenities'),
]);

function scoreIfMatches(input: unknown, regex: string, weight: number): Record<string, unknown> {
  return {
    $cond: [{ $regexMatch: { input, regex, options: 'i' } }, weight, 0],
  };
}

/**
 * `$addFields` fragment producing `_kwScore` for the given query.
 * Returns `{}` for blank queries so callers can spread it unconditionally.
 */
export function buildKeywordScoreFields(query: string | undefined): Record<string, unknown> {
  const phrase = query?.trim();
  if (!phrase) return {};

  const escapedPhrase = escapeRegexTerm(phrase);
  const parts: Record<string, unknown>[] = [
    // Whole-phrase matches: the strongest signal that this is what was typed.
    {
      $cond: [
        { $eq: [{ $toLower: TITLE_EXPR }, phrase.toLowerCase()] },
        200,
        0,
      ],
    },
    scoreIfMatches(TITLE_EXPR, `^${escapedPhrase}`, 90),
    scoreIfMatches(TITLE_EXPR, escapedPhrase, 60),
    scoreIfMatches(LOCATION_EXPR, escapedPhrase, 45),
    scoreIfMatches(TAGS_EXPR, escapedPhrase, 35),
    scoreIfMatches(CATEGORY_EXPR, escapedPhrase, 20),
    scoreIfMatches(DESCRIPTION_EXPR, escapedPhrase, 15),
  ];

  // Per-word matches: rewards covering more of the query across better fields.
  for (const term of extractKeywordTerms(phrase)) {
    const escaped = escapeRegexTerm(term);
    parts.push(
      scoreIfMatches(TITLE_EXPR, escaped, 10),
      scoreIfMatches(LOCATION_EXPR, escaped, 8),
      scoreIfMatches(TAGS_EXPR, escaped, 5),
      scoreIfMatches(CATEGORY_EXPR, escaped, 4),
      scoreIfMatches(DESCRIPTION_EXPR, escaped, 2)
    );
  }

  return { [LISTING_KEYWORD_SCORE_KEY]: { $add: parts } };
}
