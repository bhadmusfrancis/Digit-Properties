import mongooseImport from 'mongoose';

type MongooseSingleton = typeof mongooseImport & { default?: typeof mongooseImport };

/**
 * Resolve the real mongoose singleton.
 * Turbopack/ESM interop sometimes yields `{ default: mongoose }` without `.models`
 * on the top-level import, which crashes as:
 *   Cannot read properties of undefined (reading 'Listing')
 */
export function mongooseConn(): typeof mongooseImport {
  const m = mongooseImport as MongooseSingleton;
  if (m && typeof m.model === 'function' && m.models) return m;
  if (m?.default && typeof m.default.model === 'function') return m.default;
  return m;
}
