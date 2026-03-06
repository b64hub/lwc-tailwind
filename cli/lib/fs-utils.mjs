/**
 * Safe file system operations.
 * Never overwrites existing files unless forced.
 */

import { writeFile, mkdir, access, readFile } from 'fs/promises';
import path from 'path';
import { success, warn } from './ui.mjs';

export async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function ensureDir(dirPath) {
    await mkdir(dirPath, { recursive: true });
}

/**
 * Write a file only if it does not already exist.
 * Logs success or skip. Returns { created } or { skipped }.
 */
export async function safeWriteFile(filePath, content, { force = false } = {}) {
    const relative = path.relative(process.cwd(), filePath);

    if (!force && await fileExists(filePath)) {
        warn(`Skipped ${relative} (already exists)`);
        return { skipped: true };
    }

    await ensureDir(path.dirname(filePath));
    await writeFile(filePath, content, 'utf-8');
    success(`Created ${relative}`);
    return { created: true };
}
