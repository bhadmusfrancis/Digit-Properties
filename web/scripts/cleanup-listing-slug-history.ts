/** Remove over-broad inferred Akwa Ibom slug history entries. */
import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import Listing from '../src/models/Listing';
import { mongoUriForConnect } from './lib/mongo-uri';

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) config({ path: envPath });
  await mongoose.connect(mongoUriForConnect(process.env.MONGODB_URI!));
  const r = await Listing.updateMany(
    { previousSlugs: /housing-estate-uyo-akwa-ibom/i },
    { $pull: { previousSlugs: /housing-estate-uyo-akwa-ibom/i } }
  );
  console.log(JSON.stringify({ modifiedCount: r.modifiedCount }));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
