import OpenAI from 'openai';
import cloudinary from '@/lib/cloudinary';
import { formatListingLocationDisplay } from '@/lib/listing-location';
import { formatListingTypeLabel, formatPropertyTypeLabel } from '@/lib/constants';

/**
 * Generate a listing photo for Facebook/Instagram when the listing has no downloadable media.
 * Uploads to Cloudinary and returns the secure URL (caller may attach to the listing).
 */
export async function generateListingSocialImage(listing: {
  title?: string;
  propertyType?: string;
  listingType?: string;
  bedrooms?: number | null;
  location?: { suburb?: string; city?: string; state?: string; address?: string } | null;
}): Promise<string | undefined> {
  if (!process.env.OPENAI_API_KEY) return undefined;
  try {
    const location = formatListingLocationDisplay(listing.location) || 'Nigeria';
    const type = formatPropertyTypeLabel(listing.propertyType || 'house');
    const listingType = formatListingTypeLabel(listing.listingType || 'sale');
    const beds =
      listing.bedrooms && listing.bedrooms > 0 ? `${listing.bedrooms}-bedroom ` : '';

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = [
      'Photorealistic Nigerian real-estate listing photograph for social media.',
      'Landscape 16:9, natural daylight, clean professional MLS style.',
      'No text, logos, watermarks, people faces, or collage.',
      `Property: ${beds}${type} for ${listingType}.`,
      `Location context: ${location}.`,
      `Listing title cue: ${(listing.title || type).slice(0, 120)}.`,
      'Show a believable exterior or interior matching the property type in a Nigerian urban or suburban setting.',
    ].join('\n');

    const result = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1536x1024',
    });
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) return undefined;

    const upload = await cloudinary.uploader.upload(`data:image/png;base64,${base64}`, {
      folder: 'listings/social-generated',
      resource_type: 'image',
    });
    return upload.secure_url;
  } catch (e) {
    console.warn('[listing-social-image]', (e as Error).message);
    return undefined;
  }
}
