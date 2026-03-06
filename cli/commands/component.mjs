/**
 * `lwc-tailwind component <name>` — Scaffold a new Tailwind-enabled LWC component.
 */

import path from 'path';
import { execSync } from 'child_process';
import { readSfProject, getProjectPaths } from '../lib/sf-project.mjs';
import { fileExists, ensureDir, safeWriteFile } from '../lib/fs-utils.mjs';
import { confirm } from '../lib/prompt.mjs';
import { heading, success, info, error, step } from '../lib/ui.mjs';
import {
    componentJs,
    componentHtml,
    componentMeta,
    toKebabCase
} from '../templates/component-scaffold.mjs';

const NAME_REGEX = /^[a-z][a-zA-Z0-9]*$/;

/**
 * CLI handler for `lwc-tailwind component <name>`.
 */
export async function component(args) {
    const componentName = args[0];

    if (!componentName) {
        error('Component name is required.');
        info('Usage: npx lwc-tailwind component myComponentName');
        process.exit(1);
    }

    // Validate camelCase name
    if (!NAME_REGEX.test(componentName)) {
        error(
            `Invalid component name "${componentName}". ` +
            'Use camelCase starting with a lowercase letter (e.g., "myButton").'
        );
        process.exit(1);
    }

    const cwd = process.cwd();

    // 1. Read project config
    const { packageDir, apiVersion } = await readSfProject(cwd);
    const paths = getProjectPaths(cwd, packageDir);

    // 2. Check if component already exists
    const componentDir = path.join(paths.lwcDir, componentName);
    if (await fileExists(componentDir)) {
        const overwrite = await confirm(
            `Component "${componentName}" already exists. Overwrite?`,
            false
        );
        if (!overwrite) {
            info('Cancelled.');
            return;
        }
    }

    // 3. Create the component
    heading(`Creating component: ${componentName}`);
    await ensureDir(componentDir);

    await safeWriteFile(
        path.join(componentDir, `${componentName}.js`),
        componentJs(componentName),
        { force: true }
    );
    await safeWriteFile(
        path.join(componentDir, `${componentName}.html`),
        componentHtml(componentName),
        { force: true }
    );
    await safeWriteFile(
        path.join(componentDir, `${componentName}.js-meta.xml`),
        componentMeta(apiVersion),
        { force: true }
    );

    // 4. Run CSS splitter to generate per-component CSS
    step('Generating per-component CSS...');
    try {
        execSync('npm run build:css', { cwd, stdio: 'pipe' });
        success('CSS generated');
    } catch {
        info('CSS build skipped — run `npm run build:css` manually');
    }

    // 5. Print success
    const tag = `c-${toKebabCase(componentName)}`;
    heading('Component created!');
    console.log('');
    info(`Files created in ${packageDir}/main/default/lwc/${componentName}/`);
    info(`Use in templates: <${tag}></${tag}>`);
    console.log('');
}
