/** Shard hosts for digitproperties.imwb9ks.mongodb.net (from Atlas SRV). */
const ATLAS_SHARD_HOSTS = [
  'ac-9qhp3dh-shard-00-00.imwb9ks.mongodb.net:27017',
  'ac-9qhp3dh-shard-00-01.imwb9ks.mongodb.net:27017',
  'ac-9qhp3dh-shard-00-02.imwb9ks.mongodb.net:27017',
];

const ATLAS_REPLICA_SET = 'atlas-1115qy-shard-0';

/**
 * Convert mongodb+srv to a direct mongodb:// URI when SRV DNS fails
 * (common on Windows hotspot/corporate DNS).
 */
export function mongoUriForConnect(uri: string): string {
  if (!uri.startsWith('mongodb+srv://')) return uri;

  const rest = uri.slice('mongodb+srv://'.length);
  const at = rest.indexOf('@');
  if (at < 0) return uri;
  const cred = rest.slice(0, at);
  const afterAt = rest.slice(at + 1);
  const slashIdx = afterAt.indexOf('/');
  const qIdx = afterAt.indexOf('?');
  const dbPath =
    slashIdx >= 0
      ? afterAt.slice(slashIdx, qIdx >= 0 ? qIdx : afterAt.length)
      : '';
  const query = qIdx >= 0 ? afterAt.slice(qIdx + 1) : '';
  const params = new URLSearchParams(query);
  params.set('ssl', 'true');
  params.set('authSource', 'admin');
  if (!params.has('replicaSet')) params.set('replicaSet', ATLAS_REPLICA_SET);
  return `mongodb://${cred}@${ATLAS_SHARD_HOSTS.join(',')}${dbPath}?${params.toString()}`;
}
