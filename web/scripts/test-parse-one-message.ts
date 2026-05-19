import { readFileSync } from 'fs';
import path from 'path';
import {
  splitChatMessages,
  parseMessageMeta,
  extractAttachmentFilenames,
  cleanBodyForParser,
} from './lib/chat-import-utils';
import { parseWhatsAppListingText } from '../src/lib/whatsapp-listing-parser';
import { listingSchema } from '../src/lib/validations';

const raw = readFileSync(
  path.join(process.cwd(), '..', 'WhatsApp Chat - WORLD MARKET1', 'chat.txt'),
  'utf8'
);

for (const id of ['00000035', '00000040', '00000041']) {
  const full = splitChatMessages(raw).find((m) => m.includes(id));
  if (!full) {
    console.log(id, 'not found');
    continue;
  }
  const { body } = parseMessageMeta(full);
  const clean = cleanBodyForParser(body);
  const { parsed } = parseWhatsAppListingText(clean);
  const payload = {
    title: parsed.title.slice(0, 200),
    description: parsed.description,
    listingType: parsed.listingType,
    propertyType: parsed.propertyType,
    price: parsed.price,
    location: parsed.location,
    bedrooms: parsed.bedrooms,
    bathrooms: parsed.bathrooms,
    toilets: 0,
    amenities: [],
    tags: [],
    rentPeriod: parsed.rentPeriod,
    status: 'active' as const,
    images: [{ url: 'https://example.com/x.jpg', public_id: 'test/x' }],
    videos: [],
  };
  const v = listingSchema.safeParse(payload);
  console.log('\n', id);
  console.log('  type', parsed.listingType, 'rentPeriod', parsed.rentPeriod, 'price', parsed.price);
  console.log('  valid', v.success);
  if (!v.success) console.log('  ', v.error.issues.map((i) => i.message).join('; '));
}
