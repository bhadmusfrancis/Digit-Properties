/**
 * Recover the original WhatsApp post text from a stored listing description.
 *
 * Descriptions of thin imports were rewritten by the human-tone generator
 * (`buildHumanListingDescriptionHtml`) and then converted to WhatsApp plain
 * text. Those generated sentences restate the *stored* listing type and price
 * ("Listed for sale on Digit Properties…", "The asking price is ₦4,500."), so
 * re-deriving type/price from the full description just re-reads the existing
 * mistake. Strip the boilerplate first and keep only the agent's own words.
 */
import { htmlDescriptionToWhatsAppPlainText } from '../../src/lib/whatsapp-description';

/** Sentences emitted verbatim by the generator (intro / closing / details / price). */
const GENERATED_SENTENCE_PATTERNS: RegExp[] = [
  // introParagraph variants
  /^this .*? is listed (?:for sale|for rent|open to joint venture)\. it may suit buyers or tenants who want a clear summary before arranging a viewing\.$/i,
  /^listed (?:for sale|for rent|open to joint venture) on digit properties: .*?\. below are the key details we have from the seller or agent\.$/i,
  /^if you are searching in .*?, this .*? is (?:for sale|for rent|open to joint venture)\. take a moment to review the layout, price, and location notes before you reach out\.$/i,
  /^a .*? (?:for sale|for rent|open to joint venture) in .*?\. we have summarised the listing in plain language so you can decide quickly whether to book an inspection\.$/i,
  // closingParagraph variants
  /^we recommend a physical inspection to confirm plot size.*$/i,
  /^please visit the property in person where possible.*$/i,
  /^arrange a viewing at a time that suits you.*$/i,
  /^digit properties connects you with the listing owner or agent.*$/i,
  // detailSentence / price line / amenity + location headers
  /^it offers .*?\.$/i,
  /^the asking price is .*?\.$/i,
  /^price is available on request — contact the listing owner for the current asking figure\.$/i,
  /^\*?features noted in this listing\*?$/i,
  /^\*?location\*?$/i,
];

/** "The property is in *X*. <closing variant>" — location paragraph. */
const LOCATION_PARAGRAPH_RE = /^the property is in \*?.*?\*?\.\s*/i;

function isGeneratedSentence(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  return GENERATED_SENTENCE_PATTERNS.some((re) => re.test(t));
}

/**
 * Strip generated copy from a description, returning the agent's original text.
 * Returns '' when nothing but boilerplate remains.
 */
export function stripGeneratedListingCopy(description: string | null | undefined): string {
  let text = String(description ?? '').trim();
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) text = htmlDescriptionToWhatsAppPlainText(text);

  const kept: string[] = [];
  for (const rawLine of text.split(/\n+/)) {
    let line = rawLine.trim();
    if (!line) continue;

    // Location paragraph: drop the "property is in X" lead + trailing closing sentence.
    if (LOCATION_PARAGRAPH_RE.test(line)) {
      line = line.replace(LOCATION_PARAGRAPH_RE, '').trim();
      if (!line || isGeneratedSentence(line)) continue;
    }
    if (isGeneratedSentence(line)) continue;

    // A paragraph may bundle generated + original sentences; filter per sentence.
    const sentences = line
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s && !isGeneratedSentence(s));
    if (!sentences.length) continue;
    kept.push(sentences.join(' '));
  }

  // Bullet amenity lines the generator produced are single short "• x" items;
  // they carry no price/type signal, so drop them.
  return kept
    .filter((l) => !/^•\s*\S{1,40}$/.test(l))
    .join('\n')
    .trim();
}

/**
 * Best available original-post text for a listing row, most trustworthy first:
 * All_chats.txt body (via `wa-fp:` tag) → `originalDescription` → description
 * with generated copy stripped.
 */
export function bestOriginalPostText(
  row: {
    description?: string | null;
    originalDescription?: string | null;
    tags?: string[] | null;
  },
  chatBodies?: Map<string, string>
): { text: string; source: 'chat' | 'originalDescription' | 'stripped-description' | 'none' } {
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const fpTag = tags.find((t) => t.startsWith('wa-fp:'));
  if (fpTag && chatBodies) {
    const fromChat = chatBodies.get(fpTag.slice('wa-fp:'.length));
    if (fromChat && fromChat.trim().length >= 20) return { text: fromChat.trim(), source: 'chat' };
  }

  const original = String(row.originalDescription ?? '').trim();
  if (original.length >= 20) {
    const cleaned = stripGeneratedListingCopy(original) || original;
    return { text: cleaned, source: 'originalDescription' };
  }

  const stripped = stripGeneratedListingCopy(row.description);
  if (stripped.length >= 20) return { text: stripped, source: 'stripped-description' };

  return { text: '', source: 'none' };
}
