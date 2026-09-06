import dns from 'dns';
import mongoose from 'mongoose';
import { mongoUriForConnect, normalizeMongoUri } from '@/lib/mongo-uri';

// Hotspot/corporate DNS often fails Atlas SRV (_mongodb._tcp) lookups on Windows.
dns.setDefaultResultOrder('ipv4first');

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null };

if (process.env.NODE_ENV !== 'production') {
  global.mongoose = cached;
}

function requireMongoUri(): string {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  if (!uri) {
    throw new Error(
      'MONGODB_URI is required and must start with mongodb:// or mongodb+srv:// (no wrapping quotes).'
    );
  }
  return uri;
}

async function attemptConnect(): Promise<typeof mongoose> {
  const rawUri = requireMongoUri();
  const directOverride = normalizeMongoUri(process.env.MONGODB_URI_DIRECT);
  const candidates = [
    directOverride,
    mongoUriForConnect(rawUri),
    rawUri,
  ].filter((u, i, arr): u is string => !!u && arr.indexOf(u) === i);

  let lastError: unknown;
  for (const uri of candidates) {
    try {
      return await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
    } catch (err) {
      lastError = err;
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect().catch(() => {});
      }
    }
  }
  throw lastError;
}

export async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = attemptConnect()
      .then((m) => {
        cached.conn = m;
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }
  return cached.promise;
}
