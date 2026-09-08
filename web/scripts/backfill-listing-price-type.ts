/**
 * Correct listing prices that were stored as a per-unit rate / fee / plot size,
 * and sale-vs-rent types that were classified against the post's own wording.
 *
 * Every candidate is re-derived from the agent's original post text (All_chats
 * via `wa-fp:` → `originalDescription` → description with generated marketing
 * copy stripped), then gated: a change is written only when the evidence is
 * explicit and the resulting figure is plausible. Multi-property bulletins and
 * posts whose quoted size disagrees with the stored size are reported for
 * manual review instead of being guessed at.
 *
 * Usage:
 *   npx tsx scripts/backfill-listing-price-type.ts                  # dry run
 *   npx tsx scripts/backfill-listing-price-type.ts --apply
 *   npx tsx scripts/backfill-listing-price-type.ts --slug <slug> --apply
 *   npx tsx scripts/backfill-listing-price-type.ts --report out.json
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import {
  analyzeListingPostSignals,
  isLikelyMispricedWhatsAppListing,
} from '../src/lib/whatsapp-listing-parser';
import {
  cleanBodyForParser,
  listingFingerprint,
  parseMessageMeta,
  splitChatMessages,
} from './lib/chat-import-utils';
import { ALL_CHATS_PATH } from './lib/chat-import-paths';
import { bestOriginalPostText } from './lib/original-post-text';

/** No genuine listing is advertised below this figure. */
const MIN_PLAUSIBLE_PRICE = 100_000;
/** Annualised rent ceiling — above this a "rate × size" product is a parse artefact. */
const MAX_PLAUSIBLE_ANNUAL_RENT = 3_000_000_000;
/**
 * Sale / JV ceiling. Nigeria's largest genuine listings sit in the tens of
 * billions; past this a "rate × size" product reflects a mega-parcel valuation
 * or a mangled size rather than an asking price.
 */
const MAX_PLAUSIBLE_SALE_PRICE = 50_000_000_000;
/** A post naming this many sale/rent intents is a bulletin, not one listing. */
const BULLETIN_INTENT_COUNT = 3;

type ListingRow = {
  _id: mongoose.Types.ObjectId;
  slug?: string;
  title?: string;
  price?: number;
  listingType?: string;
  rentPeriod?: string;
  area?: number;
  description?: string;
  originalDescription?: string;
  tags?: string[];
  soldAt?: Date | null;
  rentedAt?: Date | null;
};

function parseArgs() {
  const argv = process.argv.slice(2);
  const at = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    apply: argv.includes('--apply'),
    slug: at('--slug'),
    report: at('--report'),
    backup: at('--backup'),
  };
}

function buildChatBodyByFingerprint(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(ALL_CHATS_PATH)) return map;
  const raw = readFileSync(ALL_CHATS_PATH, 'utf8');
  for (const full of splitChatMessages(raw)) {
    const { body, senderPhone } = parseMessageMeta(full);
    const clean = cleanBodyForParser(body);
    if (clean.length < 15) continue;
    map.set(listingFingerprint(clean, senderPhone), clean);
  }
  return map;
}

function annualised(price: number, rentPeriod?: string): number {
  if (rentPeriod === 'month') return price * 12;
  if (rentPeriod === 'day') return price * 365;
  return price;
}

function isPlausiblePrice(price: number, listingType: string, rentPeriod?: string): boolean {
  if (!Number.isFinite(price) || price < MIN_PLAUSIBLE_PRICE) return false;
  if (listingType === 'rent') return annualised(price, rentPeriod) <= MAX_PLAUSIBLE_ANNUAL_RENT;
  return price <= MAX_PLAUSIBLE_SALE_PRICE;
}

/** Within 1% — the stored figure is the quoted rate itself. */
function approxEqual(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.max(a, b) < 0.01;
}

/**
 * True for agent bulletins that advertise several properties in one message
 * ("1) 500sqm ₦900m 2) 720sqm ₦1.2b …"). Any single figure picked from these
 * may belong to a different property, so they are never auto-corrected.
 */
function isMultiItemBulletin(text: string): boolean {
  const numbered = (text.match(/(?:^|[\s*])\(?\d{1,2}[).]\s/g) ?? []).length;
  const sizes = new Set(
    (text.match(/\b[\d,.]+\s*(?:sqm|sq\.?\s*m|m²|m2|square\s*met\w*)/gi) ?? []).map((s) =>
      s.toLowerCase().replace(/\s+/g, '')
    )
  );
  const priceLabels = (text.match(/\b(?:price|land\s*value|value|rent|asking)\s*[:\-–—#]/gi) ?? [])
    .length;
  return numbered >= 2 || sizes.size >= 3 || priceLabels >= 3;
}

/** Listings can only store NGN, so a foreign-currency quote must not be copied in. */
function quotesForeignCurrency(text: string): boolean {
  return /(?:\busd\b|us\s?\$|\$\s?[\d,]|\bdollars?\b|\beuros?\b|£\s?[\d,])/i.test(text);
}

/**
 * Price reasons safe to apply automatically. "area m² mistaken for millions"
 * is excluded: in practice it fires on bulletins and JV premiums and replaces a
 * correct total with a per-sqm rate or an unrelated figure.
 */
const AUTO_APPLY_PRICE_REASONS = new Set([
  'per-sqm rate stored instead of total',
  'per-sqft rate stored instead of total',
  'fee percent stored as price',
  'scaled amount in description',
  'rent below realistic minimum',
  'description mentions m/k/bn amount',
  'area/size stored as price',
  'reparsed price much higher',
]);

type Change = {
  id: string;
  slug?: string;
  title?: string;
  source: string;
  price?: { from: number; to: number; reason: string };
  type?: { from: string; to: string; rentPeriod?: string };
  review?: string;
  head?: string;
};

async function main() {
  const { apply, slug, report, backup } = parseArgs();
  /** Pre-change state of every document written, so a run can be reverted. */
  const backupRows: Array<Record<string, unknown>> = [];

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing (set in .env.local)');
    process.exit(1);
  }

  const chatBodies = buildChatBodyByFingerprint();
  console.log(`Loaded ${chatBodies.size} chat fingerprints from All_chats.txt`);

  await mongoose.connect(process.env.MONGODB_URI);

  const filter: Record<string, unknown> = {};
  if (slug) filter.slug = slug;

  const rows = (await Listing.find(filter)
    .select(
      '_id slug title price listingType rentPeriod area description originalDescription tags soldAt rentedAt'
    )
    .lean()
    .exec()) as ListingRow[];

  const priceFixes: Change[] = [];
  const typeFixes: Change[] = [];
  const needsReview: Change[] = [];
  let scanned = 0;
  let noSource = 0;
  let updated = 0;

  for (const row of rows) {
    scanned++;
    const { text, source } = bestOriginalPostText(row, chatBodies);
    if (!text || text.length < 20) {
      noSource++;
      continue;
    }

    const storedPrice = Number(row.price) || 0;
    const storedType = String(row.listingType ?? 'sale');
    const storedPeriod = row.rentPeriod ? String(row.rentPeriod) : undefined;
    const sig = analyzeListingPostSignals(text);
    const head = text.replace(/\s+/g, ' ').slice(0, 150);
    const base: Change = { id: String(row._id), slug: row.slug, title: row.title, source, head };
    const isBulletin = sig.rentIntentCount + sig.saleIntentCount >= BULLETIN_INTENT_COUNT;

    // ---- sale vs rent -----------------------------------------------------
    let nextType = storedType;
    let nextPeriod = storedPeriod;
    // A post with no letting/selling wording but a clear rent cycle ("₦8.5m per
    // annum", "Rent 11m yearly") is a letting the old parser silently filed as
    // a sale. Trust that only in the sale→rent direction and only when the post
    // never mentions selling.
    const inferredRentIsSound =
      !sig.hasExplicitIntent &&
      sig.listingType === 'rent' &&
      storedType === 'sale' &&
      sig.saleIntentCount === 0 &&
      Boolean(sig.rentPeriod);

    if (sig.listingType !== storedType) {
      if (!sig.hasExplicitIntent && !inferredRentIsSound) {
        needsReview.push({ ...base, review: `type ${storedType}→${sig.listingType}: intent only inferred` });
      } else if (isBulletin) {
        needsReview.push({
          ...base,
          review: `type ${storedType}→${sig.listingType}: multi-property bulletin (${sig.rentIntentCount} rent / ${sig.saleIntentCount} sale mentions)`,
        });
      } else {
        nextType = sig.listingType;
        nextPeriod = nextType === 'rent' ? (sig.rentPeriod ?? storedPeriod ?? 'year') : undefined;
        typeFixes.push({ ...base, type: { from: storedType, to: nextType, rentPeriod: nextPeriod } });
      }
    }

    // ---- price ------------------------------------------------------------
    const candidate = sig.price;
    let priceReason: string | undefined;
    const rate = sig.pricePerSqm ?? sig.pricePerSqft;
    const hasSize = Boolean(sig.areaSqm || sig.areaSqft);

    if (candidate > 0 && candidate !== storedPrice) {
      if (rate && hasSize && approxEqual(storedPrice, rate)) {
        // Stored figure is the quoted per-unit rate; the asking price is rate × size.
        const quotedSize = sig.pricePerSqm ? sig.areaSqm : sig.areaSqft;
        const storedSize = Number(row.area) || 0;
        const sizeAgrees =
          !sig.pricePerSqm || !storedSize || approxEqual(storedSize, quotedSize) ||
          Math.abs(storedSize - quotedSize) / Math.max(storedSize, quotedSize) < 0.02;
        // rate × size can only exceed the rate itself, so a smaller total
        // means the size was mangled (e.g. "1.500Sqmt" read as 1.5 sqm).
        if (sizeAgrees && candidate > storedPrice) {
          priceReason = sig.pricePerSqm
            ? 'per-sqm rate stored instead of total'
            : 'per-sqft rate stored instead of total';
        } else if (sizeAgrees) {
          needsReview.push({
            ...base,
            review: `price ${storedPrice}→${candidate}: rate × size is below the stored figure; size parse unreliable`,
          });
        } else {
          needsReview.push({
            ...base,
            review: `price ${storedPrice}→${candidate}: post quotes ${quotedSize} sqm but listing stores ${storedSize} sqm`,
          });
        }
      } else {
        const chk = isLikelyMispricedWhatsAppListing({
          price: storedPrice,
          listingType: nextType,
          rentPeriod: nextPeriod,
          description: text,
        });
        if (chk.mispriced && chk.reparsedPrice === candidate && chk.reason) priceReason = chk.reason;
      }
    }

    if (priceReason && !AUTO_APPLY_PRICE_REASONS.has(priceReason)) {
      needsReview.push({
        ...base,
        review: `price ${storedPrice}→${candidate} (${priceReason}): reason not auto-applied`,
      });
      priceReason = undefined;
    }
    if (priceReason && (isBulletin || isMultiItemBulletin(text))) {
      needsReview.push({
        ...base,
        review: `price ${storedPrice}→${candidate} (${priceReason}): multi-property bulletin`,
      });
      priceReason = undefined;
    }
    if (priceReason && quotesForeignCurrency(text)) {
      needsReview.push({
        ...base,
        review: `price ${storedPrice}→${candidate} (${priceReason}): post quotes a foreign currency`,
      });
      priceReason = undefined;
    }
    if (priceReason && !isPlausiblePrice(candidate, nextType, nextPeriod)) {
      needsReview.push({
        ...base,
        review: `price ${storedPrice}→${candidate} (${priceReason}): implausible, rejected`,
      });
      priceReason = undefined;
    }

    if (priceReason) {
      priceFixes.push({ ...base, price: { from: storedPrice, to: candidate, reason: priceReason } });
    }

    // ---- write ------------------------------------------------------------
    const typeChanged = nextType !== storedType;
    if (!apply || (!typeChanged && !priceReason)) continue;

    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};
    if (priceReason) set.price = candidate;
    if (typeChanged) {
      set.listingType = nextType;
      if (nextType === 'rent') {
        set.rentPeriod = nextPeriod ?? 'year';
        // A listing marked sold that was really a letting keeps its date as rented.
        if (row.soldAt && !row.rentedAt) {
          set.rentedAt = row.soldAt;
          unset.soldAt = '';
        }
      } else {
        unset.rentPeriod = '';
        if (row.rentedAt && !row.soldAt && nextType === 'sale') {
          set.soldAt = row.rentedAt;
          unset.rentedAt = '';
        }
      }
    }

    backupRows.push({
      _id: String(row._id),
      slug: row.slug,
      price: storedPrice,
      listingType: storedType,
      rentPeriod: storedPeriod ?? null,
      soldAt: row.soldAt ?? null,
      rentedAt: row.rentedAt ?? null,
    });

    await Listing.updateOne(
      { _id: row._id },
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      }
    );
    updated++;
  }

  const summary = {
    scanned,
    noSource,
    apply,
    updated: apply ? updated : undefined,
    counts: {
      priceFixes: priceFixes.length,
      typeFixes: typeFixes.length,
      needsReview: needsReview.length,
    },
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nPrice fixes (first 20):');
  console.log(JSON.stringify(priceFixes.slice(0, 20), null, 2));
  console.log('\nType fixes (first 20):');
  console.log(JSON.stringify(typeFixes.slice(0, 20), null, 2));
  console.log('\nNeeds review (first 20):');
  console.log(JSON.stringify(needsReview.slice(0, 20), null, 2));

  if (backup && backupRows.length) {
    writeFileSync(
      path.resolve(process.cwd(), backup),
      JSON.stringify(backupRows, null, 2),
      'utf8'
    );
    console.log(`\nPre-change state of ${backupRows.length} listings saved to ${backup}`);
  }

  if (report) {
    writeFileSync(
      path.resolve(process.cwd(), report),
      JSON.stringify({ summary, priceFixes, typeFixes, needsReview }, null, 2),
      'utf8'
    );
    console.log(`\nFull report written to ${report}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
