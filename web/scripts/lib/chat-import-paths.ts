import path from 'path';
import { existsSync, readdirSync } from 'fs';

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

/** All WhatsApp export folders under `root` that contain `_chat.txt`. */
export function discoverChatExportDirs(root: string = REPO_ROOT): string[] {
  const out: string[] = [];

  function walk(dir: string) {
    let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const hasChat = entries.some((e) => e.isFile() && e.name === '_chat.txt');
    if (hasChat) {
      out.push(dir);
      return;
    }

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'web') continue;
      walk(path.join(dir, e.name));
    }
  }

  walk(root);
  return out.sort();
}

/** Prefer `chat.txt` built from `_chat.txt`; fall back to raw `_chat.txt`. */
export function resolveChatExportTextPath(exportDir: string): string | null {
  const built = path.join(exportDir, 'chat.txt');
  const raw = path.join(exportDir, '_chat.txt');
  if (existsSync(built)) return built;
  if (existsSync(raw)) return raw;
  return null;
}

export function chatExportLabel(exportDir: string): string {
  return path.basename(exportDir);
}
