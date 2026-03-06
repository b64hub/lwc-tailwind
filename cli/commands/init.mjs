/**
 * `lwc-tailwind init` — Add Tailwind CSS to an existing Salesforce project.
 *
 * Also exports runInitSteps() for reuse by the `create` command.
 */

import path from 'path';
import { execSync } from 'child_process';
import { readSfProject, getProjectPaths } from '../lib/sf-project.mjs';
import { installDevDeps } from '../lib/npm-utils.mjs';
import { addNpmScripts } from '../lib/npm-utils.mjs';
import { safeWriteFile, ensureDir } from '../lib/fs-utils.mjs';
import { heading, success, info, error, step } from '../lib/ui.mjs';
import {
    tailwindConfig,
    postcssConfig,
    tailwindCssSource
} from '../templates/configs.mjs';
import {
    tailwindElementJs,
    tailwindElementMeta,
    tailwindUtilsJs,
    tailwindUtilsMeta,
    staticResourceMeta
} from '../templates/runtime.mjs';
import {
    devScript,
    cssSplitterIndex,
    cssSplitterParser,
    cssSplitterClassExtractor,
    cssSplitterCssWriter
} from '../templates/scripts.mjs';

const DEV_DEPS = [
    'tailwindcss@3',
    'postcss',
    'postcss-cli',
    'autoprefixer',
    'cssnano',
    'chokidar'
];

/**
 * Core init logic — reused by both `init` and `create` commands.
 */
export async function runInitSteps(cwd) {
    // 1. Read project config
    heading('Reading project configuration');
    const { packageDir, apiVersion } = await readSfProject(cwd);
    info(`Package directory: ${packageDir}`);
    info(`API version: ${apiVersion}`);

    const paths = getProjectPaths(cwd, packageDir);

    // 2. Install npm dev dependencies
    heading('Installing dependencies');
    step('Installing tailwindcss, postcss, autoprefixer, cssnano, chokidar...');
    installDevDeps(DEV_DEPS, cwd);
    success('Dependencies installed');

    // 3. Create config files
    heading('Creating configuration files');
    await safeWriteFile(path.join(cwd, 'tailwind.config.js'), tailwindConfig());
    await safeWriteFile(path.join(cwd, 'postcss.config.js'), postcssConfig());

    // 4. Create src/tailwind.css
    await ensureDir(path.join(cwd, 'src'));
    await safeWriteFile(path.join(cwd, 'src/tailwind.css'), tailwindCssSource());

    // 5. Create static resource meta XML
    heading('Creating static resource');
    await ensureDir(paths.staticResourceDir);
    await safeWriteFile(
        path.join(paths.staticResourceDir, 'tailwind.resource-meta.xml'),
        staticResourceMeta()
    );

    // 6. Create runtime LWC components
    heading('Creating runtime components');

    // tailwindElement
    const twElDir = path.join(paths.lwcDir, 'tailwindElement');
    await ensureDir(twElDir);
    await safeWriteFile(path.join(twElDir, 'tailwindElement.js'), tailwindElementJs());
    await safeWriteFile(
        path.join(twElDir, 'tailwindElement.js-meta.xml'),
        tailwindElementMeta(apiVersion)
    );

    // tailwindUtils
    const twUtilDir = path.join(paths.lwcDir, 'tailwindUtils');
    await ensureDir(twUtilDir);
    await safeWriteFile(path.join(twUtilDir, 'tailwindUtils.js'), tailwindUtilsJs());
    await safeWriteFile(
        path.join(twUtilDir, 'tailwindUtils.js-meta.xml'),
        tailwindUtilsMeta(apiVersion)
    );

    // 7. Create build scripts
    heading('Creating build scripts');

    // scripts/dev.mjs
    await ensureDir(paths.scriptsDir);
    await safeWriteFile(path.join(paths.scriptsDir, 'dev.mjs'), devScript(packageDir));

    // scripts/css-splitter/*
    await ensureDir(paths.cssSplitterDir);
    await safeWriteFile(
        path.join(paths.cssSplitterDir, 'index.mjs'),
        cssSplitterIndex(packageDir)
    );
    await safeWriteFile(
        path.join(paths.cssSplitterDir, 'css-parser.mjs'),
        cssSplitterParser()
    );
    await safeWriteFile(
        path.join(paths.cssSplitterDir, 'class-extractor.mjs'),
        cssSplitterClassExtractor()
    );
    await safeWriteFile(
        path.join(paths.cssSplitterDir, 'css-writer.mjs'),
        cssSplitterCssWriter()
    );

    // 8. Add npm scripts
    heading('Adding npm scripts');
    const staticResourceCss = `${packageDir}/main/default/staticresources/tailwind.css`;
    await addNpmScripts(cwd, {
        dev: 'node scripts/dev.mjs',
        'split:css': 'node scripts/css-splitter/index.mjs',
        'build:css': `postcss src/tailwind.css -o ${staticResourceCss} && node scripts/css-splitter/index.mjs`,
        'build:css:prod': `NODE_ENV=production postcss src/tailwind.css -o ${staticResourceCss} && node scripts/css-splitter/index.mjs`
    });

    // 9. Run initial CSS build
    heading('Running initial CSS build');
    try {
        execSync('npm run build:css', { cwd, stdio: 'pipe' });
        success('Initial CSS build complete');
    } catch {
        info('Initial CSS build skipped (no components using Tailwind classes yet)');
    }

    return { packageDir, apiVersion, paths };
}

/**
 * CLI handler for `lwc-tailwind init`.
 */
export async function init() {
    const cwd = process.cwd();

    await runInitSteps(cwd);

    heading('Done!');
    console.log('');
    info('Tailwind CSS has been added to your project.');
    console.log('');
    info('Next steps:');
    step('Run `npm run dev` to start the dev watcher');
    step('Create a component: `npx lwc-tailwind component myComponent`');
    step('Use Tailwind classes in your HTML templates');
    console.log('');
}
