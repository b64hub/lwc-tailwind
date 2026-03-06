/**
 * Tailwind CSS Per-Component Splitter
 *
 * Takes the full compiled Tailwind CSS and generates a tiny CSS file
 * per LWC component containing only the rules that component uses.
 *
 * Usage:
 *   node scripts/css-splitter/index.mjs          (CLI)
 *   import { splitCss } from './css-splitter/index.mjs'  (programmatic)
 */

import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseTailwindCss } from './css-parser.mjs';
import { extractComponentClasses } from './class-extractor.mjs';
import { buildComponentCss, writeComponentCss } from './css-writer.mjs';

// ── Default Config ──────────────────────────────────────────

const DEFAULTS = {
    tailwindCssPath: 'force-app/main/default/staticresources/tailwind.css',
    lwcDir: 'force-app/main/default/lwc',
    excludeComponents: ['tailwindElement', 'tailwindUtils', 'cssLibTailwind']
};

// ── Main ────────────────────────────────────────────────────

/**
 * Split the compiled Tailwind CSS into per-component CSS files.
 *
 * @param {object} [userConfig] - Override default configuration
 * @returns {Promise<Array<{component, classesFound, rulesIncluded, outputBytes, cssPath}>>}
 */
export async function splitCss(userConfig = {}) {
    const config = { ...DEFAULTS, ...userConfig };
    const cwd = process.cwd();

    // 1. Read the full compiled CSS
    const fullCssPath = path.resolve(cwd, config.tailwindCssPath);
    const fullCss = await readFile(fullCssPath, 'utf-8');

    // 2. Parse: extract base block + build class→rule map
    const { baseString, classMap } = parseTailwindCss(fullCss);

    // 3. Discover LWC component directories
    const lwcRoot = path.resolve(cwd, config.lwcDir);
    const entries = await readdir(lwcRoot, { withFileTypes: true });
    const components = entries
        .filter(
            (e) => e.isDirectory() && !config.excludeComponents.includes(e.name)
        )
        .map((e) => ({ name: e.name, path: path.join(lwcRoot, e.name) }));

    // 4. Process each component
    const results = [];
    const writtenPaths = [];

    for (const comp of components) {
        // 4a. Extract classes used by this component
        const usedClasses = await extractComponentClasses(comp.path, comp.name);

        // Skip components that don't use any Tailwind classes
        if (usedClasses.size === 0) continue;

        // 4b. Build the per-component CSS
        const generatedCss = buildComponentCss(usedClasses, classMap, baseString);

        // Count how many rules were actually matched
        let rulesIncluded = 0;
        for (const cls of usedClasses) {
            if (classMap.has(cls)) rulesIncluded++;
        }

        // 4c. Write into the component's CSS file
        const cssPath = await writeComponentCss(comp.path, comp.name, generatedCss);
        writtenPaths.push(cssPath);

        results.push({
            component: comp.name,
            classesFound: usedClasses.size,
            rulesIncluded,
            outputBytes: Buffer.byteLength(generatedCss, 'utf-8'),
            cssPath
        });
    }

    return { results, writtenPaths };
}

// ── CLI Entry Point ─────────────────────────────────────────

const isMain =
    process.argv[1] &&
    path.resolve(process.argv[1]) ===
        path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
    const start = Date.now();
    splitCss()
        .then(({ results }) => {
            console.log('');
            console.log('  Tailwind CSS Splitter');
            console.log('  ─────────────────────');
            console.log('');
            for (const r of results) {
                const kb = (r.outputBytes / 1024).toFixed(1);
                console.log(
                    `  ${r.component}: ${r.classesFound} classes found, ${r.rulesIncluded} rules matched (${kb} KB)`
                );
            }
            const elapsed = ((Date.now() - start) / 1000).toFixed(2);
            console.log('');
            console.log(`  Done in ${elapsed}s`);
            console.log('');
        })
        .catch((err) => {
            console.error('CSS splitting failed:', err.message);
            process.exit(1);
        });
}
