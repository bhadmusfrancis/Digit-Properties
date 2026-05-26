/**
 * Resolve Nigerian city/state (and optional suburb) from free text using the
 * in-repo {@link NIGERIA_STATE_CITY_SUBURBS} gazetteer (states → cities → suburbs).
 *
 * Used for WhatsApp/import parsing and for backfills when structured location was wrong.
 */
import { NIGERIAN_STATES } from '@/lib/constants';
import { NIGERIA_STATE_CITY_SUBURBS } from '@/lib/nigeria-locations';

const MIN_SINGLE_WORD_PHRASE = 4;

/** Tokens that appear in many states and cause false positives as single-word matches. */
const AMBIGUOUS_SINGLE_WORDS = new Set([
  'gra',
  'cbd',
  'town',
  'road',
  'estate',
  'north',
  'south',
  'east',
  'west',
  'phase',
  'area',
  'layout',
  'market',
  'village',
  'municipal',
  'division',
  'housing',
  'park',
  'hill',
  'camp',
  'gate',
  'station',
  'junction',
  'bridge',
  'port',
  'main',
  'line',
  'bank',
  'level',
  'zone',
  'field',
  'view',
  'city',
  'island',
  'land',
  'point',
  'site',
  'works',
  'office',
  'close',
  'drive',
  'avenue',
  'street',
]);

/** Chat / STT typos → fragment that appears in the gazetteer (substring replace in lowercased text). */
export const NIGERIA_PLACE_CHAT_TYPOS: Record<string, string> = {
  jayi: 'jahi',
  jaiye: 'jahi',
  jhai: 'jahi',
};

export type ResolvedNigeriaPlace = {
  state: string;
  city: string;
  suburb?: string;
  matchedPhrase: string;
  confidence: 'high' | 'medium' | 'low';
};

type IndexedPlace = {
  phrase: string;
  phraseLower: string;
  city: string;
  state: string;
  len: number;
};

function shouldIndexPhrase(phraseLower: string): boolean {
  const words = phraseLower.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  if (words.length === 1) {
    const w = words[0];
    if (w.length < MIN_SINGLE_WORD_PHRASE) return false;
    if (AMBIGUOUS_SINGLE_WORDS.has(w)) return false;
  }
  return true;
}

function escapePhraseForBoundary(phraseLower: string): string {
  return phraseLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

/** Word-boundary match; avoids hits like `vi` inside `available`. */
export function phraseInTextBoundary(fullLower: string, phraseLower: string): boolean {
  const compact = escapePhraseForBoundary(phraseLower);
  if (!compact) return false;
  return new RegExp(`\\b${compact}\\b`, 'i').test(fullLower);
}

function normalizeForTypoReplace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function applyTypoCorrections(textLower: string): string {
  let t = textLower;
  for (const [typo, fix] of Object.entries(NIGERIA_PLACE_CHAT_TYPOS)) {
    const re = new RegExp(`\\b${escapePhraseForBoundary(typo)}\\b`, 'gi');
    t = t.replace(re, fix);
  }
  return t;
}

function buildSortedIndex(): IndexedPlace[] {
  const rows: IndexedPlace[] = [];
  const seen = new Set<string>();

  for (const [state, cities] of Object.entries(NIGERIA_STATE_CITY_SUBURBS)) {
    for (const [city, suburbs] of Object.entries(cities)) {
      const add = (phrase: string) => {
        const trimmed = phrase.trim();
        if (!trimmed) return;
        const phraseLower = trimmed.toLowerCase();
        if (!shouldIndexPhrase(phraseLower)) return;
        const key = `${phraseLower}\0${city}\0${state}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({
          phrase: trimmed,
          phraseLower,
          city,
          state,
          len: phraseLower.length,
        });
      };

      add(city);
      for (const suburb of suburbs) add(suburb);
    }
  }

  rows.sort((a, b) => b.len - a.len || a.phraseLower.localeCompare(b.phraseLower));
  return rows;
}

let cachedRows: IndexedPlace[] | null = null;
let cachedByPhrase: Map<string, IndexedPlace[]> | null = null;

function getIndex(): { rows: IndexedPlace[]; byPhrase: Map<string, IndexedPlace[]> } {
  if (cachedRows && cachedByPhrase) return { rows: cachedRows, byPhrase: cachedByPhrase };
  const rows = buildSortedIndex();
  const byPhrase = new Map<string, IndexedPlace[]>();
  for (const r of rows) {
    const list = byPhrase.get(r.phraseLower) ?? [];
    list.push(r);
    byPhrase.set(r.phraseLower, list);
  }
  cachedRows = rows;
  cachedByPhrase = byPhrase;
  return { rows, byPhrase };
}

/** Exposed for tests / diagnostics. */
export function getNigeriaGazetteerPlaceCount(): number {
  return getIndex().rows.length;
}

/**
 * Detect a Nigerian state / FCT from explicit mentions (longest state name first).
 */
export function detectNigerianStateInText(textLower: string): string | undefined {
  const sortedStates = [...NIGERIAN_STATES].sort((a, b) => b.length - a.length);
  for (const s of sortedStates) {
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/g, '\\s*');
    if (new RegExp(`\\b${esc}\\b`, 'i').test(textLower)) return s;
  }

  if (/\b(fct|f\.c\.t\.?|federal\s+capital\s+territory)\b/i.test(textLower)) return 'FCT';
  if (/\babuja\b/i.test(textLower)) return 'FCT';
  if (/\b(port\s*har(?:c)?ourt|pitakwa)\b/i.test(textLower)) return 'Rivers';

  return undefined;
}

function pickDisambiguated(
  candidates: IndexedPlace[],
  textLower: string,
  hintedState: string | undefined
): IndexedPlace {
  let pool = candidates;
  if (hintedState) {
    const filtered = candidates.filter((c) => c.state === hintedState);
    if (filtered.length > 0) pool = filtered;
  }
  if (pool.length === 1) return pool[0];

  let best: IndexedPlace | null = null;
  let bestScore = -1;
  for (const c of pool) {
    let score = 0;
    if (hintedState && c.state === hintedState) score += 50;
    const cityLw = c.city.toLowerCase();
    if (cityLw !== c.phraseLower && phraseInTextBoundary(textLower, cityLw)) score += 30;
    if (phraseInTextBoundary(textLower, c.phraseLower)) score += 10 + Math.min(c.phraseLower.length, 40);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best ?? pool[0];
}

function confidenceForMatch(p: IndexedPlace): ResolvedNigeriaPlace['confidence'] {
  const wc = p.phraseLower.split(/\s+/).length;
  if (wc >= 2 || p.phraseLower.length >= 12) return 'high';
  if (p.phraseLower.length >= 7) return 'medium';
  return 'low';
}

/**
 * Best-effort place resolution from unstructured copy (WhatsApp listings, descriptions).
 */
export function resolveNigeriaPlaceFromText(
  rawText: string,
  opts?: { preferredState?: string }
): ResolvedNigeriaPlace | null {
  const textLower = normalizeForTypoReplace(rawText.toLowerCase());
  if (!textLower) return null;
  const withTyposFixed = applyTypoCorrections(textLower);

  const hinted =
    opts?.preferredState ||
    detectNigerianStateInText(textLower) ||
    detectNigerianStateInText(withTyposFixed);

  const { rows, byPhrase } = getIndex();

  for (const row of rows) {
    if (!phraseInTextBoundary(withTyposFixed, row.phraseLower)) continue;

    const cands = byPhrase.get(row.phraseLower) ?? [row];
    const chosen = pickDisambiguated(cands, withTyposFixed, hinted);

    const suburb =
      chosen.phraseLower === chosen.city.toLowerCase()
        ? undefined
        : chosen.phrase;

    return {
      state: chosen.state,
      city: chosen.city,
      suburb,
      matchedPhrase: chosen.phrase,
      confidence: confidenceForMatch(chosen),
    };
  }

  return null;
}
