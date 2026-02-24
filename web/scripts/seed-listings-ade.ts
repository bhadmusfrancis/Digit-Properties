/**
 * Seed 19 listings with pictures for user Ade (bhadmusfrancis@yahoo.com).
 * Run from web dir: npx tsx scripts/seed-listings-ade.ts
 * Requires: MONGODB_URI in .env.local
 */

import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import User from '../src/models/User';

const ADE_EMAIL = 'bhadmusfrancis@yahoo.com';
const ADE_NAME = 'Ade';

const LISTINGS_FOR_ADE = [
  { title: 'Luxury 4-Bedroom Duplex in Lekki Phase 1', description: 'Beautiful fully finished duplex with modern amenities. Spacious living areas, fitted kitchen, and a large compound. Security and 24hr power backup. Ideal for executives.', listingType: 'sale' as const, propertyType: 'duplex' as const, price: 185_000_000, location: { address: '5 Adeola Odeku Street, Lekki Phase 1', city: 'Lagos', state: 'Lagos' }, bedrooms: 4, bathrooms: 5, toilets: 6, area: 450, amenities: ['Parking', 'Security', 'Pool', 'Generator', 'Fitted Kitchen'], tags: ['luxury', 'lekki', '4-bedroom', 'duplex'] },
  { title: '2-Bedroom Apartment for Rent in Victoria Island', description: 'Cozy apartment in a secure estate. Well-maintained, close to offices and shopping centers. Available immediately.', listingType: 'rent' as const, propertyType: 'apartment' as const, price: 2_500_000, location: { address: 'Block 12, Oniru Estate', city: 'Lagos', state: 'Lagos' }, bedrooms: 2, bathrooms: 2, area: 95, amenities: ['Parking', 'Security', '24hr Power'], tags: ['vi', '2-bedroom', 'estate'], rentPeriod: 'year' as const },
  { title: 'Plot of Land in Maitama, Abuja', description: 'Prime residential plot in Maitama District. Fully serviced, good title. Ready for development. 500sqm.', listingType: 'sale' as const, propertyType: 'land' as const, price: 75_000_000, location: { address: 'Plot 245, Maitama District', city: 'Abuja', state: 'FCT' }, bedrooms: 0, bathrooms: 0, area: 500, amenities: [], tags: ['land', 'maitama', 'abuja', 'residential'] },
  { title: '3-Bedroom Semi-Detached in Port Harcourt', description: 'Spacious 3-bedroom with BQ. Serene environment, good road network. Ideal for families.', listingType: 'sale' as const, propertyType: 'house' as const, price: 45_000_000, location: { address: 'Eliozu Road', city: 'Port Harcourt', state: 'Rivers' }, bedrooms: 3, bathrooms: 3, area: 220, amenities: ['Parking', 'Security', 'BQ'], tags: ['3-bedroom', 'ph', 'family'] },
  { title: 'Studio Apartment in Yaba', description: 'Compact studio for young professionals. Walking distance to UNILAG and tech hubs. Monthly rent.', listingType: 'rent' as const, propertyType: 'studio' as const, price: 450_000, location: { address: 'Borno Way, Yaba', city: 'Lagos', state: 'Lagos' }, bedrooms: 1, bathrooms: 1, area: 35, amenities: ['Parking', 'Security'], tags: ['studio', 'yaba', 'affordable'], rentPeriod: 'month' as const },
  { title: '5-Bedroom Villa in Ikeja GRA', description: 'Exclusive villa with lush garden. Marble floors, smart home features. Perfect for high-net-worth individuals.', listingType: 'sale' as const, propertyType: 'villa' as const, price: 220_000_000, location: { address: '12 Oba Oluwale Street, Ikeja GRA', city: 'Lagos', state: 'Lagos' }, bedrooms: 5, bathrooms: 6, toilets: 7, area: 650, amenities: ['Parking', 'Pool', 'Gym', 'Security', 'Generator', 'Garden'], tags: ['villa', 'ikeja', 'gra', 'luxury'] },
  { title: 'Commercial Office Space in Wuse 2, Abuja', description: '200sqm office space in prime location. Fully fitted, reception area, meeting rooms. Available for lease.', listingType: 'rent' as const, propertyType: 'commercial' as const, price: 1_800_000, location: { address: 'Plot 33, Ademola Adetokunbo Crescent', city: 'Abuja', state: 'FCT' }, bedrooms: 0, bathrooms: 3, area: 200, amenities: ['Parking', 'Security', 'Elevator', 'AC'], tags: ['commercial', 'office', 'abuja'], rentPeriod: 'month' as const },
  { title: '3-Bedroom Terrace in Ajah', description: 'Affordable terrace house in developing area. Good access road. Suitable for first-time buyers.', listingType: 'sale' as const, propertyType: 'terrace' as const, price: 35_000_000, location: { address: 'Orchid Road, Lekki', city: 'Lagos', state: 'Lagos' }, bedrooms: 3, bathrooms: 2, area: 150, amenities: ['Parking', 'Security'], tags: ['terrace', 'ajah', 'affordable'] },
  { title: 'Penthouse with City Views in Ikoyi', description: 'Stunning penthouse on the 15th floor. Panoramic views of Lagos. Top-of-the-range finishes.', listingType: 'sale' as const, propertyType: 'penthouse' as const, price: 450_000_000, location: { address: '1004 Estate, Ikoyi', city: 'Lagos', state: 'Lagos' }, bedrooms: 4, bathrooms: 5, area: 380, amenities: ['Parking', 'Pool', 'Gym', 'Security', 'Concierge'], tags: ['penthouse', 'ikoyi', 'luxury', 'views'] },
  { title: '4-Bedroom House for Rent in Garki, Abuja', description: 'Fully furnished family home. Quiet neighborhood. Available for annual lease.', listingType: 'rent' as const, propertyType: 'house' as const, price: 4_500_000, location: { address: 'Area 11, Garki', city: 'Abuja', state: 'FCT' }, bedrooms: 4, bathrooms: 4, area: 280, amenities: ['Parking', 'Security', 'Generator', 'Furnished'], tags: ['abuja', 'garki', '4-bedroom', 'furnished'], rentPeriod: 'year' as const },
  { title: 'Residential Plot in Bodija, Ibadan', description: '600sqm plot in Bodija. C of O. Good drainage. Ready for building.', listingType: 'sale' as const, propertyType: 'land' as const, price: 18_000_000, location: { address: 'Bodija Estate', city: 'Ibadan', state: 'Oyo' }, bedrooms: 0, bathrooms: 0, area: 600, amenities: [], tags: ['land', 'ibadan', 'bodija'] },
  { title: '2-Bedroom Apartment in Surulere', description: 'Clean 2-bedroom in a quiet street. Close to National Stadium. Ideal for small families.', listingType: 'rent' as const, propertyType: 'apartment' as const, price: 900_000, location: { address: 'Adeniran Ogunsanya Street', city: 'Lagos', state: 'Lagos' }, bedrooms: 2, bathrooms: 2, area: 85, amenities: ['Parking', 'Security'], tags: ['surulere', '2-bedroom', 'affordable'], rentPeriod: 'year' as const },
  { title: '3-Bedroom Duplex in Enugu', description: 'Modern duplex in Independence Layout. Tiled throughout. Servants quarters.', listingType: 'sale' as const, propertyType: 'duplex' as const, price: 42_000_000, location: { address: 'Independence Layout', city: 'Enugu', state: 'Enugu' }, bedrooms: 3, bathrooms: 4, area: 280, amenities: ['Parking', 'Security', 'BQ', 'Generator'], tags: ['enugu', 'duplex', '3-bedroom'] },
  { title: '1-Bedroom Apartment in Alausa', description: 'Small but comfortable 1-bedroom. Close to secretariat. Great for singles.', listingType: 'rent' as const, propertyType: 'apartment' as const, price: 550_000, location: { address: 'Oba Ogunji Road', city: 'Lagos', state: 'Lagos' }, bedrooms: 1, bathrooms: 1, area: 55, amenities: ['Parking', 'Security'], tags: ['alausa', '1-bedroom', 'affordable'], rentPeriod: 'month' as const },
  { title: 'Commercial Land in Trans Amadi, PH', description: '1000sqm commercial plot. High visibility. Suitable for warehouse or showroom.', listingType: 'sale' as const, propertyType: 'land' as const, price: 95_000_000, location: { address: 'Trans Amadi Industrial Layout', city: 'Port Harcourt', state: 'Rivers' }, bedrooms: 0, bathrooms: 0, area: 1000, amenities: [], tags: ['commercial', 'land', 'ph', 'industrial'] },
  { title: '4-Bedroom House in Magodo Phase 2', description: 'Spacious family home with large compound. Servants quarters. Serene environment.', listingType: 'sale' as const, propertyType: 'house' as const, price: 75_000_000, location: { address: 'Shangisha, Magodo Phase 2', city: 'Lagos', state: 'Lagos' }, bedrooms: 4, bathrooms: 4, area: 320, amenities: ['Parking', 'Security', 'BQ', 'Generator', 'Garden'], tags: ['magodo', '4-bedroom', 'family'] },
  { title: '2-Bedroom Apartment in Asokoro, Abuja', description: 'Well-appointed apartment in highbrow Asokoro. 24hr security. Gym and pool in estate.', listingType: 'rent' as const, propertyType: 'apartment' as const, price: 2_200_000, location: { address: 'Asokoro District', city: 'Abuja', state: 'FCT' }, bedrooms: 2, bathrooms: 2, area: 110, amenities: ['Parking', 'Security', 'Pool', 'Gym'], tags: ['asokoro', 'abuja', '2-bedroom'], rentPeriod: 'year' as const },
  { title: 'Shop Space in Computer Village, Ikeja', description: 'Ground floor shop in busy Computer Village. High foot traffic. Ideal for phone/tech business.', listingType: 'rent' as const, propertyType: 'commercial' as const, price: 1_200_000, location: { address: 'Otigba Street, Computer Village', city: 'Lagos', state: 'Lagos' }, bedrooms: 0, bathrooms: 1, area: 45, amenities: ['Security'], tags: ['commercial', 'shop', 'ikeja', 'computer-village'], rentPeriod: 'year' as const },
  { title: '3-Bedroom Bungalow in Benin City', description: 'Solid bungalow in GRA Benin. Well maintained. C of O available.', listingType: 'sale' as const, propertyType: 'house' as const, price: 38_000_000, location: { address: '1st Avenue, GRA', city: 'Benin City', state: 'Edo' }, bedrooms: 3, bathrooms: 3, area: 180, amenities: ['Parking', 'Security', 'Generator'], tags: ['benin', 'bungalow', 'gra'] },
];

const IMAGES_BY_PROPERTY_TYPE: Record<string, { public_id: string; url: string }[]> = {
  duplex: [
    { public_id: 'seed-ade/duplex-1', url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800' },
    { public_id: 'seed-ade/duplex-2', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800' },
    { public_id: 'seed-ade/duplex-3', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800' },
  ],
  apartment: [
    { public_id: 'seed-ade/apartment-1', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800' },
    { public_id: 'seed-ade/apartment-2', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800' },
    { public_id: 'seed-ade/apartment-3', url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800' },
  ],
  land: [
    { public_id: 'seed-ade/land-1', url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800' },
    { public_id: 'seed-ade/land-2', url: 'https://images.unsplash.com/photo-1507537362848-9c7e70b7b5c1?w=800' },
  ],
  house: [
    { public_id: 'seed-ade/house-1', url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800' },
    { public_id: 'seed-ade/house-2', url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800' },
    { public_id: 'seed-ade/house-3', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800' },
  ],
  villa: [
    { public_id: 'seed-ade/villa-1', url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800' },
    { public_id: 'seed-ade/villa-2', url: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800' },
  ],
  commercial: [
    { public_id: 'seed-ade/commercial-1', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800' },
    { public_id: 'seed-ade/commercial-2', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800' },
  ],
  default: [
    { public_id: 'seed-ade/default-1', url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800' },
    { public_id: 'seed-ade/default-2', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800' },
    { public_id: 'seed-ade/default-3', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800' },
  ],
};

function getImages(propertyType: string, listingIndex: number): { public_id: string; url: string }[] {
  const list = IMAGES_BY_PROPERTY_TYPE[propertyType] || IMAGES_BY_PROPERTY_TYPE.default;
  return list.map((img, j) => ({
    ...img,
    public_id: `${img.public_id}-L${listingIndex}-${j}`,
  }));
}

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI required. Ensure .env.local exists and is loaded.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  let user = await User.findOne({ email: ADE_EMAIL });
  if (!user) {
    console.error(`User with email ${ADE_EMAIL} not found. Create the user first (e.g. sign up or add via admin).`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (user.name !== ADE_NAME) {
    await User.findByIdAndUpdate(user._id, { name: ADE_NAME });
    console.log(`Updated user name to "${ADE_NAME}".`);
  }

  const listings = LISTINGS_FOR_ADE.map((l, i) => {
    const { rentPeriod, ...rest } = l as typeof l & { rentPeriod?: 'day' | 'month' | 'year' };
    const doc: Record<string, unknown> = {
      ...rest,
      status: 'active',
      createdBy: user!._id,
      createdByType: 'user',
      images: getImages(l.propertyType, i),
      agentName: ADE_NAME,
      agentEmail: ADE_EMAIL,
      agentPhone: '',
      viewCount: 0,
    };
    if (l.listingType === 'rent' && rentPeriod) doc.rentPeriod = rentPeriod;
    return doc;
  });

  await Listing.insertMany(listings);
  console.log(`Seeded ${listings.length} listings with pictures for ${ADE_NAME} (${ADE_EMAIL}).`);
  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
