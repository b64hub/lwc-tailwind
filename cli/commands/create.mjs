/**
 * `lwc-tailwind create [name]` — Create a new Salesforce project with Tailwind pre-configured.
 */

import path from 'path';
import { execSync } from 'child_process';
import { ask, confirm } from '../lib/prompt.mjs';
import { fileExists, ensureDir, safeWriteFile } from '../lib/fs-utils.mjs';
import { heading, success, info, error, step, banner } from '../lib/ui.mjs';
import { runInitSteps } from './init.mjs';
import {
    componentJs,
    componentHtml,
    componentMeta
} from '../templates/component-scaffold.mjs';

const NAME_REGEX = /^[a-z][a-z0-9-]*$/;

/**
 * CLI handler for `lwc-tailwind create [name]`.
 */
export async function create(args) {
    let projectName = args[0];

    // 1. Get project name
    if (!projectName) {
        projectName = await ask('Project name');
    }

    if (!projectName) {
        error('Project name is required.');
        process.exit(1);
    }

    // Validate name
    if (!NAME_REGEX.test(projectName)) {
        error(
            `Invalid project name "${projectName}". ` +
            'Use lowercase letters, numbers, and hyphens (e.g., "my-project").'
        );
        process.exit(1);
    }

    const projectDir = path.resolve(process.cwd(), projectName);

    // 2. Check if directory already exists
    if (await fileExists(projectDir)) {
        error(`Directory "${projectName}" already exists.`);
        process.exit(1);
    }

    heading('Creating Salesforce project');

    // 3. Run sf project generate
    step('Running sf project generate...');
    try {
        execSync(`sf project generate -n ${projectName}`, {
            cwd: process.cwd(),
            stdio: 'inherit'
        });
    } catch {
        error(
            'Failed to create Salesforce project. Make sure the Salesforce CLI is installed:\n' +
            '  npm install -g @salesforce/cli'
        );
        process.exit(1);
    }

    // 4. Initialize npm
    step('Initializing npm...');
    try {
        execSync('npm init -y', { cwd: projectDir, stdio: 'pipe' });
        success('npm initialized');
    } catch {
        error('Failed to run npm init.');
        process.exit(1);
    }

    // 5. Run init steps (install deps, create configs, etc.)
    const { apiVersion, paths } = await runInitSteps(projectDir);

    // 6. Optionally create a demo component
    const createDemo = await confirm('Create a demo component?');
    if (createDemo) {
        heading('Creating demo component');
        const demoName = 'tailwindDemo';
        const demoDir = path.join(paths.lwcDir, demoName);
        await ensureDir(demoDir);
        await safeWriteFile(path.join(demoDir, `${demoName}.js`), componentJs(demoName));
        await safeWriteFile(path.join(demoDir, `${demoName}.html`), componentHtml(demoName));
        await safeWriteFile(
            path.join(demoDir, `${demoName}.js-meta.xml`),
            componentMeta(apiVersion)
        );

        // Rebuild CSS to include the demo component
        try {
            execSync('npm run build:css', { cwd: projectDir, stdio: 'pipe' });
            success('Demo component CSS generated');
        } catch {
            // Not critical
        }
    }

    heading('Project created!');
    console.log('');
    info(`Your project is ready at ./${projectName}`);
    console.log('');
    info('Next steps:');
    step(`cd ${projectName}`);
    step('Connect to a Salesforce org: sf org login web');
    step('Start developing: npm run dev');
    console.log('');
}
