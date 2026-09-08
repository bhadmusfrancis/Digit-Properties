/**
 * Assertions for WhatsApp price + sale/rent parsing, built from real posts that
 * had been imported with the wrong figure or the wrong type.
 *
 * Usage: npx tsx scripts/check-parser-price-type.ts   (exit 1 on any failure)
 */
import { parseWhatsAppListingText } from '../src/lib/whatsapp-listing-parser';
import { stripGeneratedListingCopy } from './lib/original-post-text';

type Expectation = {
  name: string;
  text: string;
  listingType: 'sale' | 'rent' | 'joint_venture';
  price?: number;
  rentPeriod?: 'day' | 'month' | 'year';
};

const CASES: Expectation[] = [
  {
    name: 'per-sqft rate × sqft size, not the rate itself',
    text: 'Amuwo odofin warehouse for lease: a bay warehouse measuring 7,200sqft with offices is available for lease @amuwo odofin industrial estate. Rate: n4,500/sqft net x 3 years payment',
    listingType: 'rent',
    price: 32_400_000,
    rentPeriod: 'year',
  },
  {
    name: 'typo multiplier on a per-sqm rate is dropped ("40,000k per sqm")',
    text: 'Kirikiri warehouse to let: a 5,600sqm self compound warehouse is available for rent in kirirkiri apapa. Rate: 40,000k per sqm asking. Terms: 3 years and above or long lease.',
    listingType: 'rent',
    price: 224_000_000,
    rentPeriod: 'year',
  },
  {
    name: 'per-sqm rate × size for rent',
    text: 'Warehouse for rent- mile 2/oshodi expressway: - total size: 2,415 sqm (26,000sqf) - location: mile 2, oshodi expressway - rate: ₦40,000 per sqm. Lease term: 2 years upfront',
    listingType: 'rent',
    price: 96_600_000,
    rentPeriod: 'year',
  },
  {
    name: 'per-sqm rate × size for sale',
    text: 'Ikoyi property 3,500sqm at old ikoyi #3m per sqm net for sale!!!',
    listingType: 'sale',
    price: 10_500_000_000,
  },
  {
    name: 'decimal comma is not a thousands separator ("2,5BILLION")',
    text: 'JOINT VENTURES @ GRA IKEJA LAND SIZE:1068.92SQMTS LAND VALUE: 2,5BILLION NAIRA, TITTLE: C OF O, PREMIUM: #300 MILLION',
    listingType: 'joint_venture',
    price: 2_500_000_000,
  },
  {
    name: 'rent cycle alone implies a letting',
    text: 'Newly built 3 bedroom flat at gbagada. 4.5m per annum. Service charge 500k.',
    listingType: 'rent',
    price: 4_500_000,
    rentPeriod: 'year',
  },
  {
    name: '"letting" is a rent intent',
    text: 'ADENIYI JONES LETTING: A Spacious and exclusive 5 bedroom duplex+ 1 bq Location: Adeniyi jones, ikeja, in a secured estate. Rent: 15m Per annum',
    listingType: 'rent',
    price: 15_000_000,
    rentPeriod: 'year',
  },
  {
    name: 'rental income in a sale pitch stays a sale',
    text: 'For sale: block of 6 flats at yaba, lagos. Price 250m. Current rental income 18m per annum. Title: c of o',
    listingType: 'sale',
    price: 250_000_000,
  },
  {
    name: '"distress sale" with a rental value stays a sale',
    text: 'DISTRESS SALE 2 Units of 2Bedroom upstairs +2Bedroom down with Miniflat. Landsize halfplot. Rental value 2M. Asking 45m',
    listingType: 'sale',
    price: 45_000_000,
  },
  {
    name: 'headline intent wins over a later mention (sale first)',
    text: 'For sale: 2,000sqm commercial plot at ikeja. Price: 850m. Buyer may also lease to tenants or use for rent purposes.',
    listingType: 'sale',
    price: 850_000_000,
  },
  {
    name: 'headline intent wins over a later mention (rent first)',
    text: 'To let: 4 bedroom duplex at lekki phase 1. Rent: 15m per annum. Owner may consider for sale later.',
    listingType: 'rent',
    price: 15_000_000,
    rentPeriod: 'year',
  },
  {
    name: 'service charge cycle is not the rent cycle',
    text: 'For sale: 4 bedroom detached duplex at ikoyi. Price: 900m. Service charge 1.5m per annum.',
    listingType: 'sale',
    price: 900_000_000,
  },
];

let failures = 0;

for (const c of CASES) {
  const { parsed } = parseWhatsAppListingText(c.text);
  const problems: string[] = [];
  if (parsed.listingType !== c.listingType) {
    problems.push(`listingType ${parsed.listingType} ≠ ${c.listingType}`);
  }
  if (c.price !== undefined && parsed.price !== c.price) {
    problems.push(`price ${parsed.price.toLocaleString()} ≠ ${c.price.toLocaleString()}`);
  }
  if (c.rentPeriod !== undefined && parsed.rentPeriod !== c.rentPeriod) {
    problems.push(`rentPeriod ${parsed.rentPeriod} ≠ ${c.rentPeriod}`);
  }
  if (problems.length) {
    failures++;
    console.error(`FAIL  ${c.name}\n      ${problems.join('; ')}`);
  } else {
    console.log(`ok    ${c.name}`);
  }
}

// The repair path depends on generated marketing copy being removable.
const stripped = stripGeneratedListingCopy(
  'This warehouse in Kirikiri, Lagos is listed for rent. It may suit buyers or tenants who want a clear summary before arranging a viewing.\n\nKirikiri warehouse to let: a 5,600sqm self compound warehouse.\n\nIt offers 5600 sqm of space.\n\nThe asking price is ₦40,000,000/year.\n\n*Location*\n\nThe property is in *Kirikiri, Apapa, Lagos*. Digit Properties connects you with the listing owner or agent — no middleman on the platform. Confirm boundaries, utilities, and paperwork during your inspection.'
);
if (stripped !== 'Kirikiri warehouse to let: a 5,600sqm self compound warehouse.') {
  failures++;
  console.error(`FAIL  generated copy stripper\n      got: ${JSON.stringify(stripped)}`);
} else {
  console.log('ok    generated copy stripper');
}

console.log(`\n${CASES.length + 1 - failures}/${CASES.length + 1} passed`);
if (failures) process.exit(1);
