/**
 * npm operations: install dependencies and add scripts to package.json.
 */

import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function installDevDeps(deps: string[], cwd: string): void {
  const depList = deps.join(' ');
  execSync(`npm install --save-dev ${depList}`, { cwd, stdio: 'inherit' });
}

export interface AddScriptsResult {
  added: string[];
  skipped: string[];
}

export async function addNpmScripts(
  cwd: string,
  scripts: Record<string, string>,
): Promise<AddScriptsResult> {
  const pkgPath = path.join(cwd, 'package.json');
  const raw = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw) as Record<string, unknown>;

  const existing = (pkg.scripts ?? {}) as Record<string, string>;
  const added: string[] = [];
  const skipped: string[] = [];

  for (const [name, value] of Object.entries(scripts)) {
    if (existing[name]) {
      skipped.push(name);
    } else {
      existing[name] = value;
      added.push(name);
    }
  }

  pkg.scripts = existing;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

  return { added, skipped };
}
