import path from 'path';

export const REPO_ROOT = path.resolve(process.cwd(), '..');

/** Global chat archive for deduplication and append-after-import (all groups). */
export const ALL_CHATS_PATH = path.join(REPO_ROOT, 'All_chats.txt');

export function slugFromChatDir(dirName: string): string {
  return dirName
    .replace(/^WhatsApp Chat\s*-\s*/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function resolveSourceDir(sourceArg: string): string {
  return path.isAbsolute(sourceArg) ? sourceArg : path.join(REPO_ROOT, sourceArg);
}
