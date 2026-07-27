/**
 * Split a mashed multi-property inventory listing into separate listings.
 *
 *   npx tsx scripts/split-mashed-multi-listing.ts <slug>
 *   npx tsx scripts/split-mashed-multi-listing.ts <slug> --apply
 */
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { mongoUriForConnect } from './lib/mongo-uri';

function parseArgs() {
  const argv = process.argv.slice(2);
  const slug = argv.find((a) => !a.startsWith('--')) ?? '';
  return { slug, apply: argv.includes('--apply') };
}

function baseFpFromTags(tags: string[]): string | undefined {
  const fp = tags.find((t) => /^wa-fp:[0-9a-f]{20,}$/i.test(t));
  return fp?.replace(/^wa-fp:/i, '');
}

async function main() {
  const { slug, apply } = parseArgs();
  if (!slug) {
    console.error('Usage: npx tsx scripts/split-mashed-multi-listing.ts <slug> [--apply]');
    process.exit(1);
  }

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const mongoose = (await import('mongoose')).default;
  const Listing = (await import('../src/models/Listing')).default;
  const { parseMultipleWhatsAppListings } = await import('../src/lib/whatsapp-listing-parser');
  const { prepareListingFieldsForSeo } = await import('../src/lib/listing-seo-prep');
  const { buildCanonicalListingTitle } = await import('../src/lib/listing-title');
  const { ensureUniqueListingSlug } = await import('../src/lib/listing-slug');
  const { recordListingPathRedirects } = await import('../src/lib/listing-path-redirect');
  const { listingSchema } = await import('../src/lib/validations');
  const { LISTING_STATUS } = await import('../src/lib/constants');
  const { stripHtml } = await import('../src/lib/utils');

  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI));

  const listing = await Listing.findOne({
    $or: [{ slug }, { previousSlugs: slug }],
  });

  if (!listing) {
    console.error('Listing not found:', slug);
    await mongoose.disconnect();
    process.exit(1);
  }

  const tags = Array.isArray(listing.tags) ? listing.tags.map(String) : [];
  const source =
    (typeof listing.originalDescription === 'string' && listing.originalDescription.trim()) ||
    stripHtml(String(listing.description || ''));

  const results = parseMultipleWhatsAppListings(source);
  const parentFp = baseFpFromTags(tags);
  const keepTags = tags.filter(
    (t) =>
      !t.startsWith('wa-fp:') &&
      t !== 'wa-rewritten' &&
      !t.startsWith('wa-split-from:')
  );

  type Planned = {
    title: string;
    price: number;
    area?: number;
    beds: number;
    type: string;
    address?: string;
    skipReason?: string;
    desc: string;
  };
  const planned: Planned[] = [];
  const toCreate: Array<{
    idx: number;
    parsed: (typeof results)[number]['parsed'];
  }> = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const desc = String(r.parsed.description || '');
    const price = Number(r.parsed.price) || 0;
    let skipReason: string | undefined;
    if (price <= 0) skipReason = 'no price';
    else if (/\bUS\s*\$|\bUSD\b/i.test(desc) && price < 100_000_000) {
      skipReason = 'USD price not converted (manual follow-up)';
    } else if (price < 50_000_000 && /\b(?:per\s+sqm|\/\s*sqm|\/\s*m2|\/\s*sqmt)\b/i.test(desc)) {
      skipReason = 'per-sqm price missing area multiply';
    }

    const title = buildCanonicalListingTitle({
      listingType: r.parsed.listingType,
      propertyType: r.parsed.propertyType,
      propertyTypes: [r.parsed.propertyType],
      address: r.parsed.location.address,
      city: r.parsed.location.city,
      state: r.parsed.location.state,
      suburb: r.parsed.location.suburb,
      bedrooms: r.parsed.bedrooms || 0,
      area: r.parsed.area,
      description: desc,
    }).slice(0, 200);

    planned.push({
      title,
      price,
      area: r.parsed.area,
      beds: r.parsed.bedrooms || 0,
      type: r.parsed.propertyType,
      address: r.parsed.location.address,
      skipReason,
      desc: desc.replace(/\s+/g, ' ').slice(0, 100),
    });
    if (!skipReason) toCreate.push({ idx: i, parsed: r.parsed });
  }

  console.log(
    JSON.stringify(
      {
        parentSlug: listing.slug,
        parentTitle: listing.title,
        splitCount: results.length,
        createCount: toCreate.length,
        planned,
        apply,
      },
      null,
      2
    )
  );

  if (!apply) {
    console.log('\nDry-run only. Pass --apply to create splits and delete the mashed parent.');
    await mongoose.disconnect();
    return;
  }

  if (toCreate.length < 2) {
    console.error('Refusing to apply: need at least 2 valid child listings.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const createdSlugs: string[] = [];

  for (const item of toCreate) {
    const r = item.parsed;
    const desc = String(r.description || '').trim();
    const title = buildCanonicalListingTitle({
      listingType: r.listingType,
      propertyType: r.propertyType,
      propertyTypes: [r.propertyType],
      address: r.location.address,
      city: r.location.city,
      state: r.location.state,
      suburb: r.location.suburb,
      bedrooms: r.bedrooms || 0,
      area: r.area,
      description: desc,
    }).slice(0, 200);

    const fpTag = parentFp
      ? `wa-fp:${item.idx === 0 ? parentFp : `${parentFp}-${item.idx}`}`
      : undefined;

    const childTags = [
      ...keepTags,
      ...(fpTag ? [fpTag] : []),
      `wa-split-from:${listing.slug}`,
    ];

    const payload = {
      title,
      description: desc,
      listingType: r.listingType,
      propertyType: r.propertyType,
      propertyTypes: [r.propertyType],
      price: r.price,
      location: {
        address: r.location.address || r.location.city || 'Victoria Island, Lagos',
        city: r.location.city || 'Victoria Island',
        state: r.location.state || 'Lagos',
        ...(r.location.suburb ? { suburb: r.location.suburb } : {}),
      },
      bedrooms: r.bedrooms || 0,
      bathrooms: r.bathrooms || 0,
      toilets: r.toilets,
      area: r.area,
      agentPhone: listing.agentPhone || r.agentPhone,
      agentName: listing.agentName,
      agentEmail: listing.agentEmail,
      rentPeriod: r.listingType === 'rent' ? r.rentPeriod || 'year' : undefined,
      amenities: [],
      tags: childTags,
      images: [],
      videos: [],
      contactSource: listing.contactSource || 'author',
      status: listing.status || LISTING_STATUS.ACTIVE,
    };

    const validated = listingSchema.safeParse(payload);
    if (!validated.success) {
      console.error(`Skip child ${item.idx + 1}: validation failed`, validated.error.flatten());
      continue;
    }

    const seoCreate = prepareListingFieldsForSeo({
      title: validated.data.title,
      description: validated.data.description,
      price: validated.data.price,
      listingType: validated.data.listingType,
      rentPeriod: validated.data.rentPeriod,
      propertyType: validated.data.propertyType,
      propertyTypes: validated.data.propertyTypes,
      location: validated.data.location,
      images: [],
      videos: [],
      tags: validated.data.tags,
      bedrooms: validated.data.bedrooms,
      bathrooms: validated.data.bathrooms,
      toilets: validated.data.toilets,
      area: validated.data.area,
      amenities: validated.data.amenities,
    });

    const childSlug = await ensureUniqueListingSlug({
      title: validated.data.title,
      location: validated.data.location,
    });

    await Listing.create({
      ...validated.data,
      description: seoCreate.description,
      ...(seoCreate.originalDescription
        ? { originalDescription: seoCreate.originalDescription }
        : {}),
      images: seoCreate.images,
      videos: seoCreate.videos.length ? seoCreate.videos : [],
      tags: seoCreate.tags,
      slug: childSlug,
      createdBy: listing.createdBy,
      createdByType: listing.createdByType || 'user',
      viewCount: 0,
    });
    createdSlugs.push(childSlug);
    console.log(`  created: ${childSlug} (₦${validated.data.price})`);
  }

  if (createdSlugs.length < 2) {
    console.error('Too few children created; leaving parent listing in place.');
    await mongoose.disconnect();
    process.exit(1);
  }

  await recordListingPathRedirects({
    _id: listing._id,
    slug: listing.slug,
    previousSlugs: listing.previousSlugs,
    location: listing.location,
  });
  await Listing.findByIdAndDelete(listing._id);
  console.log(`\nDeleted mashed parent: ${listing.slug}`);
  console.log(`Created ${createdSlugs.length} listings.`);

  // Keep the old public URL as the first child's primary slug (no redirect).
  if (createdSlugs[0] && listing.slug) {
    const parentSlug = String(listing.slug);
    const first = await Listing.findOne({ slug: createdSlugs[0] });
    if (first) {
      const ListingPathRedirect = (await import('../src/models/ListingPathRedirect')).default;
      await ListingPathRedirect.deleteMany({
        pathSegment: { $in: [parentSlug, createdSlugs[0]] },
      });
      const droppedNew = createdSlugs[0];
      first.slug = parentSlug;
      first.previousSlugs = (Array.isArray(first.previousSlugs) ? first.previousSlugs : [])
        .map(String)
        .filter((s) => s && s !== parentSlug && s !== droppedNew);
      await first.save();
      createdSlugs[0] = parentSlug;
      console.log(`Restored primary slug on first child: ${parentSlug} (dropped ${droppedNew})`);
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
