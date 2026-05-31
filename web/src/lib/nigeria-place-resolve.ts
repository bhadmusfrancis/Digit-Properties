/**
 * Resolve Nigerian city/state (and optional suburb) from free text using the
 * in-repo {@link NIGERIA_STATE_CITY_SUBURBS} gazetteer (states → cities → suburbs).
 *
 * Used for WhatsApp/import parsing and for backfills when structured location was wrong.
 */
import { NIGERIAN_STATES } from '@/lib/constants';
import { NIGERIA_STATE_CITY_SUBURBS } from '@/lib/nigeria-locations';

const MIN_SINGLE_WORD_PHRASE = 4;

/**
 * Multi-word gazetteer labels that appear in generic listing copy nationwide
 * (e.g. "federal housing estate", "owode housing estate") and must not drive place resolution.
 */
const GENERIC_MULTIWORD_PHRASES = new Set([
  'housing estate',
  'state housing',
  'federal housing',
  'new town',
  'old town',
  'town hall',
]);

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
  if (GENERIC_MULTIWORD_PHRASES.has(phraseLower)) return false;
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
      const add = (phrase: string, opts?: { isCity?: boolean }) => {
        const trimmed = phrase.trim();
        if (!trimmed) return;
        const phraseLower = trimmed.toLowerCase();
        if (!opts?.isCity && !shouldIndexPhrase(phraseLower)) return;
        if (opts?.isCity) {
          const w = phraseLower.split(/\s+/).filter(Boolean);
          if (w.length === 1 && AMBIGUOUS_SINGLE_WORDS.has(w[0]!)) return;
        }
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

      add(city, { isCity: true });
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
 * Detect all Nigerian states / FCT explicitly mentioned in text (longest names first).
 */
export function detectAllNigerianStatesInText(textLower: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const sortedStates = [...NIGERIAN_STATES].sort((a, b) => b.length - a.length);
  for (const s of sortedStates) {
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/g, '\\s*');
    if (new RegExp(`\\b${esc}\\b`, 'i').test(textLower) && !seen.has(s)) {
      seen.add(s);
      found.push(s);
    }
  }

  if (/\b(fct|f\.c\.t\.?|federal\s+capital\s+territory)\b/i.test(textLower) && !seen.has('FCT')) {
    found.push('FCT');
  }
  if (/\babuja\b/i.test(textLower) && !seen.has('FCT')) {
    found.push('FCT');
  }
  if (/\b(port\s*har(?:c)?ourt|pitakwa)\b/i.test(textLower) && !seen.has('Rivers')) {
    found.push('Rivers');
  }

  return found;
}

/**
 * Detect a Nigerian state / FCT from explicit mentions (longest state name first).
 */
export function detectNigerianStateInText(textLower: string): string | undefined {
  return detectAllNigerianStatesInText(textLower)[0];
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

  const mentionedStates = [
    ...detectAllNigerianStatesInText(textLower),
    ...detectAllNigerianStatesInText(withTyposFixed),
  ].filter((s, i, arr) => arr.indexOf(s) === i);

  const hinted =
    opts?.preferredState ?? (mentionedStates.length === 1 ? mentionedStates[0] : undefined);

  const { rows, byPhrase } = getIndex();

  for (const row of rows) {
    if (!phraseInTextBoundary(withTyposFixed, row.phraseLower)) continue;

    const cands = byPhrase.get(row.phraseLower) ?? [row];
    let pool = cands;

    if (mentionedStates.length > 0) {
      const inMentioned = cands.filter((c) => mentionedStates.includes(c.state));
      if (inMentioned.length > 0) pool = inMentioned;
      else continue;
    } else if (hinted) {
      const inHinted = cands.filter((c) => c.state === hinted);
      if (inHinted.length === 0) continue;
      pool = inHinted;
    }

    const chosen = pickDisambiguated(pool, withTyposFixed, hinted);

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
