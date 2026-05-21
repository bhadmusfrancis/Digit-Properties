/**
 * Backward-compatible wrapper for WORLD MARKET1 imports.
 */
import { spawnSync } from 'child_process';

const extra = process.argv.slice(2);
const r = spawnSync(
  'npx',
  ['tsx', 'scripts/import-whatsapp-chat-batch.ts', '--source-dir', 'WhatsApp Chat - WORLD MARKET1', ...extra],
  { cwd: process.cwd(), stdio: 'inherit', shell: true }
);
process.exit(r.status ?? 1);
