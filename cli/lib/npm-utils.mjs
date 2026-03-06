/**
 * npm operations: install dependencies, add scripts.
 */

import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { success, warn } from './ui.mjs';

export function installDevDeps(deps, cwd) {
    execSync(`npm install --save-dev ${deps.join(' ')}`, {
        cwd,
        stdio: 'inherit'
    });
}

/**
 * Add scripts to package.json without overwriting existing ones.
 */
export async function addNpmScripts(cwd, scripts) {
    const pkgPath = path.join(cwd, 'package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
    pkg.scripts = pkg.scripts || {};

    const added = [];
    const skipped = [];

    for (const [name, command] of Object.entries(scripts)) {
        if (pkg.scripts[name]) {
            skipped.push(name);
        } else {
            pkg.scripts[name] = command;
            added.push(name);
        }
    }

    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

    if (added.length) success(`Added npm scripts: ${added.join(', ')}`);
    if (skipped.length) warn(`Skipped npm scripts (already exist): ${skipped.join(', ')}`);

    return { added, skipped };
}
