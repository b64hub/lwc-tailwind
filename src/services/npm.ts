/**
 * npm operations: install dependencies and add scripts to package.json.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function addDevDeps(deps: string[], cwd: string): Promise<string[]> {
  const pkgPath = path.join(cwd, 'package.json');
  const raw = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  const added: string[] = [];

  for (const dep of deps) {
    const match = dep.match(/^(@?[^@]+)(?:@(.+))?$/);
    if (!match) continue;
    const [, name, version] = match;
    if (!devDeps[name!]) {
      devDeps[name!] = version ?? 'latest';
      added.push(dep);
    }
  }

  pkg.devDependencies = devDeps;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  return added;
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
