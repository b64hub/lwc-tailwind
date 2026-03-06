/**
 * Salesforce project detection and configuration.
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { fileExists } from './fs-utils.mjs';

/**
 * Read sfdx-project.json and extract key values.
 * Throws with a helpful message if not found.
 */
export async function readSfProject(cwd = process.cwd()) {
    const filePath = path.join(cwd, 'sfdx-project.json');

    if (!await fileExists(filePath)) {
        throw new Error(
            'No sfdx-project.json found. This does not appear to be a Salesforce project.\n' +
            '  Run this command from a project root, or use "npx lwc-tailwind create" to start a new project.'
        );
    }

    const raw = JSON.parse(await readFile(filePath, 'utf-8'));
    const defaultPkg = raw.packageDirectories?.find((p) => p.default) || raw.packageDirectories?.[0];
    const packageDir = defaultPkg?.path || 'force-app';
    const apiVersion = raw.sourceApiVersion || '62.0';

    return { packageDir, apiVersion, raw };
}

/**
 * Derive common paths from project config.
 */
export function getProjectPaths(cwd, packageDir) {
    return {
        lwcDir: path.join(cwd, packageDir, 'main/default/lwc'),
        staticResourceDir: path.join(cwd, packageDir, 'main/default/staticresources'),
        scriptsDir: path.join(cwd, 'scripts'),
        cssSplitterDir: path.join(cwd, 'scripts/css-splitter'),
        srcDir: path.join(cwd, 'src')
    };
}
