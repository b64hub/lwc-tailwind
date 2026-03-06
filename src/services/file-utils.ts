/**
 * Safe, non-destructive file operations.
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export interface WriteResult {
  created: boolean;
  skipped: boolean;
  path: string;
}

export async function safeWriteFile(
  filePath: string,
  content: string,
  options: { force?: boolean } = {},
): Promise<WriteResult> {
  const relative = path.relative(process.cwd(), filePath);

  if (!options.force && (await fileExists(filePath))) {
    return { created: false, skipped: true, path: relative };
  }

  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, content, 'utf-8');
  return { created: true, skipped: false, path: relative };
}
