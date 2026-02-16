/**
 * Seed first admin user.
 * Run: npm run seed
 * Requires: MONGODB_URI in .env.local
 */

import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@digitproperties.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No db');

  const users = db.collection('users');
  const existing = await users.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    await users.updateOne(
      { email: ADMIN_EMAIL },
      { $set: { role: 'admin' } }
    );
    console.log('Admin role set for', ADMIN_EMAIL);
  } else {
    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await users.insertOne({
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: hashed,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Admin user created:', ADMIN_EMAIL);
  }

  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
