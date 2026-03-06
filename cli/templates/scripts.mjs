/**
 * Script file templates: dev.mjs, css-splitter modules.
 *
 * All templates accept { packageDir } for dynamic path resolution.
 */

export function devScript(packageDir) {
    const lwcDir = `${packageDir}/main/default/lwc`;
    const staticResourceCss = `${packageDir}/main/default/staticresources/tailwind.css`;

    return `/**
 * Dev watcher for Tailwind CSS + LWC.
 *
 * Watches your LWC files for changes, rebuilds Tailwind CSS,
 * splits CSS per component, and deploys to your Salesforce org automatically.
 *
 * Usage: npm run dev
 */

import chokidar from 'chokidar';
import { execSync } from 'child_process';
import path from 'path';
import { splitCss } from './css-splitter/index.mjs';

// ── Config ──────────────────────────────────────────────────

// Directories to watch (chokidar v4+ doesn't support globs — watch dirs instead)
const WATCH_DIRS = [
    '${lwcDir}',
    'src'
];

// Only react to these file extensions
const WATCH_EXTENSIONS = new Set(['.html', '.js', '.css']);

// Files to ignore (these are generated, not hand-edited)
const IGNORE_FILE = '${staticResourceCss}';

// Paths written by the CSS splitter (populated at runtime, ignored by watcher)
let splitterWrittenPaths = new Set();

// How long to wait after the last file change before rebuilding.
// This prevents rebuilding 5 times when you save 5 files quickly.
const DEBOUNCE_MS = 300;

// ── Helpers ─────────────────────────────────────────────────

function timestamp() {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function log(msg) {
    console.log(\`  [\${timestamp()}] \${msg}\`);
}

function logError(msg) {
    console.error(\`  [\${timestamp()}] \${msg}\`);
}

/**
 * Rebuilds Tailwind CSS by running PostCSS.
 * Returns true if the build succeeded.
 */
function buildCSS() {
    try {
        execSync('npx postcss src/tailwind.css -o ${staticResourceCss}', {
            stdio: 'pipe'
        });
        return true;
    } catch (err) {
        logError('CSS build failed:');
        console.error(err.stderr?.toString() || err.message);
        return false;
    }
}

/**
 * Deploys changed files to the Salesforce org.
 */
function deploy() {
    try {
        execSync('sf project deploy start --source-dir ${packageDir} --ignore-conflicts 2>&1', {
            stdio: 'pipe'
        });
        return true;
    } catch (err) {
        logError('Deploy failed:');
        console.error(err.stdout?.toString() || err.message);
        return false;
    }
}

// ── Main ────────────────────────────────────────────────────

console.log('');
console.log('  ⚡ Tailwind LWC Dev Server');
console.log('  ─────────────────────────');
console.log('');

// Step 1: Do an initial build so everything is fresh
log('Initial CSS build...');
if (buildCSS()) {
    log('CSS built successfully');
    // Split CSS per component on startup
    try {
        const { results, writtenPaths } = await splitCss();
        splitterWrittenPaths = new Set(writtenPaths);
        log(\`Split into \${results.length} components\`);
    } catch (err) {
        logError('CSS splitting failed: ' + err.message);
    }
} else {
    logError('Initial build failed — fix errors above and save a file to retry');
}

console.log('');
log('Watching for changes...');
log('Press Ctrl+C to stop');
console.log('');

// Step 2: Start watching files
let debounceTimer = null;
let changedFiles = new Set();

const watcher = chokidar.watch(WATCH_DIRS, {
    ignoreInitial: true,
    recursive: true
});

/**
 * Called when a file changes. Debounces to avoid rebuilding
 * multiple times when saving several files at once.
 */
function onFileChange(filePath) {
    const relative = path.relative(process.cwd(), filePath);
    const ext = path.extname(filePath);

    if (!WATCH_EXTENSIONS.has(ext)) return;
    if (relative === IGNORE_FILE) return;
    if (splitterWrittenPaths.has(path.resolve(process.cwd(), relative))) return;

    changedFiles.add(relative);

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
        const files = [...changedFiles];
        changedFiles.clear();

        for (const f of files) {
            log(\`Changed: \${f}\`);
        }

        const start = Date.now();

        log('Rebuilding CSS...');
        if (!buildCSS()) {
            logError('Skipping deploy (CSS build failed)');
            console.log('');
            return;
        }

        log('Splitting CSS per component...');
        try {
            const { results, writtenPaths } = await splitCss();
            splitterWrittenPaths = new Set(writtenPaths);
            const total = results.reduce((sum, r) => sum + r.rulesIncluded, 0);
            log(\`Split into \${results.length} components (\${total} rules matched)\`);
        } catch (err) {
            logError('CSS splitting failed:');
            console.error(err.message);
        }

        log('Deploying to org...');
        if (deploy()) {
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            log(\`Done (\${elapsed}s)\`);
        }
        console.log('');
    }, DEBOUNCE_MS);
}

watcher.on('change', onFileChange);
watcher.on('add', onFileChange);
watcher.on('unlink', (filePath) => {
    log(\`Deleted: \${path.relative(process.cwd(), filePath)}\`);
});

process.on('SIGINT', () => {
    console.log('');
    log('Stopping...');
    watcher.close();
    process.exit(0);
});
`;
}

export function cssSplitterIndex(packageDir) {
    const tailwindCssPath = `${packageDir}/main/default/staticresources/tailwind.css`;
    const lwcDir = `${packageDir}/main/default/lwc`;

    return `/**
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
    tailwindCssPath: '${tailwindCssPath}',
    lwcDir: '${lwcDir}',
    excludeComponents: ['tailwindElement', 'tailwindUtils', 'cssLibTailwind']
};

// ── Main ────────────────────────────────────────────────────

/**
 * Split the compiled Tailwind CSS into per-component CSS files.
 *
 * @param {object} [userConfig] - Override default configuration
 * @returns {Promise<{results: Array, writtenPaths: Array}>}
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
        const usedClasses = await extractComponentClasses(comp.path, comp.name);

        if (usedClasses.size === 0) continue;

        const generatedCss = buildComponentCss(usedClasses, classMap, baseString);

        let rulesIncluded = 0;
        for (const cls of usedClasses) {
            if (classMap.has(cls)) rulesIncluded++;
        }

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
                    \`  \${r.component}: \${r.classesFound} classes found, \${r.rulesIncluded} rules matched (\${kb} KB)\`
                );
            }
            const elapsed = ((Date.now() - start) / 1000).toFixed(2);
            console.log('');
            console.log(\`  Done in \${elapsed}s\`);
            console.log('');
        })
        .catch((err) => {
            console.error('CSS splitting failed:', err.message);
            process.exit(1);
        });
}
`;
}

export function cssSplitterParser() {
    return `/**
 * CSS Parser for the Tailwind CSS Splitter.
 *
 * Parses the compiled Tailwind CSS output into two parts:
 * 1. The "base block" — CSS variable initialization (*, ::before, ::after, ::backdrop)
 * 2. A class-to-rules map — lookup from Tailwind class name to its CSS rule(s)
 */

import postcss from 'postcss';

/**
 * Extract the Tailwind class name from a CSS selector.
 *
 * Examples:
 *   ".px-4"                           → "px-4"
 *   ".hover\\\\:bg-brand-dark:hover"    → "hover:bg-brand-dark"
 *   ".focus\\\\:ring-2:focus"           → "focus:ring-2"
 *   ".md\\\\:grid-cols-3"              → "md:grid-cols-3"
 *   ".space-y-2 > :not([hidden]) ~"  → "space-y-2"
 *   ".pb-\\\\[200px\\\\]"                → "pb-[200px]"
 *   ".mt-0\\\\.5"                      → "mt-0.5"
 */
function extractClassFromSelector(selector) {
    // Match the first class selector: dot followed by escaped/unescaped chars
    const match = selector.match(/\\.((?:[a-zA-Z0-9_-]|\\\\.)+)/);
    if (!match) return null;
    // Unescape: \\: → :, \\[ → [, \\] → ], \\/ → /, \\. → .
    return match[1].replace(/\\\\(.)/g, '$1');
}

/**
 * Check if a rule node is part of the Tailwind CSS variable base block.
 * These are rules with selectors like "*, ::before, ::after" or "::backdrop"
 * where all declarations are --tw-* custom properties.
 */
function isBaseRule(node) {
    if (node.type !== 'rule') return false;
    const sel = node.selector.replace(/\\s+/g, ' ').trim();
    // Must NOT contain a class selector
    if (sel.includes('.')) return false;
    // Must contain universal selector or pseudo-elements only
    if (!(/^[*,:>\\s~+\\w()-]+$/.test(sel.replace(/::/g, '').replace(/:/g, '')))) return false;
    // All declarations must be --tw-* variables
    return node.nodes.every(
        (n) => n.type === 'decl' && n.prop.startsWith('--tw-')
    );
}

/**
 * Parse the full compiled Tailwind CSS and return:
 * - baseString: the CSS variable initialization block as a string
 * - classMap: Map<className, Array<{ ruleText, wrapperName?, wrapperParams? }>>
 */
export function parseTailwindCss(cssString) {
    const root = postcss.parse(cssString);
    const baseNodes = [];
    const classMap = new Map();

    // Pass 1: extract the base block (always at the top of the file)
    let passedBase = false;
    for (const node of root.nodes) {
        if (!passedBase) {
            if (isBaseRule(node)) {
                baseNodes.push(node);
                continue;
            }
            if (node.type === 'comment') {
                baseNodes.push(node);
                continue;
            }
            // First non-base, non-comment node — we're past the base block
            passedBase = true;
        }

        // Pass 2: build the class map
        if (node.type === 'rule') {
            const cls = extractClassFromSelector(node.selector);
            if (cls) {
                if (!classMap.has(cls)) classMap.set(cls, []);
                classMap.get(cls).push({
                    ruleText: node.toString(),
                    wrapperName: null,
                    wrapperParams: null
                });
            }
        } else if (node.type === 'atrule') {
            // e.g., @media (min-width: 768px) { .md\\:grid-cols-3 { ... } }
            for (const child of node.nodes) {
                if (child.type === 'rule') {
                    const cls = extractClassFromSelector(child.selector);
                    if (cls) {
                        if (!classMap.has(cls)) classMap.set(cls, []);
                        classMap.get(cls).push({
                            ruleText: child.toString(),
                            wrapperName: node.name,
                            wrapperParams: node.params
                        });
                    }
                }
            }
        }
    }

    // Convert base nodes to string
    const baseString = baseNodes.map((n) => n.toString()).join('\\n');

    return { baseString, classMap };
}

export { extractClassFromSelector };
`;
}

export function cssSplitterClassExtractor() {
    return `/**
 * Class Extractor for the Tailwind CSS Splitter.
 *
 * Scans a component's HTML and JS files to find all Tailwind class names used.
 * Intentionally broad — false positives are harmless (extra CSS rules included),
 * but false negatives would break styling.
 */

import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Heuristic check: does this string token look like a Tailwind class name?
 *
 * Accepts: "px-4", "hover:bg-brand-dark", "md:grid-cols-3", "pb-[200px]", "mt-0.5"
 * Rejects: "c/tailwindUtils", "@salesforce/resourceUrl/tailwind", "primary", "lwc"
 */
function isTailwindClassName(token) {
    if (token.length < 2) return false;
    if (token.includes('/')) return false;
    if (token.startsWith('@')) return false;
    if (/[a-z][A-Z]/.test(token)) return false;
    return /^[a-z!-][\\w./:[\\]-]*$/.test(token);
}

/**
 * Extract class names from an HTML template.
 * Matches class="..." attributes and splits by whitespace.
 */
function extractClassesFromHtml(html) {
    const classes = new Set();
    const regex = /class\\s*=\\s*["']([^"']+)["']/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        for (const cls of match[1].split(/\\s+/)) {
            if (cls) classes.add(cls);
        }
    }
    return classes;
}

/**
 * Extract class names from a JS file.
 * Finds all string literals (single/double quoted), splits by whitespace,
 * and filters through the Tailwind class name heuristic.
 */
function extractClassesFromJs(jsSource) {
    const classes = new Set();
    const stringRegex = /(?:'([^'\\\\]*(?:\\\\.[^'\\\\]*)*)'|"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)")/g;
    let match;
    while ((match = stringRegex.exec(jsSource)) !== null) {
        const str = match[1] ?? match[2];
        if (!str) continue;
        for (const token of str.split(/\\s+/)) {
            if (token && isTailwindClassName(token)) {
                classes.add(token);
            }
        }
    }
    return classes;
}

/**
 * Extract all Tailwind class names used by a component.
 * Reads the component's .html and .js files and combines results.
 *
 * @param {string} componentDir - Full path to the component directory
 * @param {string} componentName - The component name (matches file names)
 * @returns {Promise<Set<string>>} Set of class names found
 */
export async function extractComponentClasses(componentDir, componentName) {
    const classes = new Set();

    const htmlPath = path.join(componentDir, \`\${componentName}.html\`);
    const jsPath = path.join(componentDir, \`\${componentName}.js\`);

    try {
        const html = await readFile(htmlPath, 'utf-8');
        for (const cls of extractClassesFromHtml(html)) {
            classes.add(cls);
        }
    } catch {
        // No HTML file — that's fine
    }

    try {
        const js = await readFile(jsPath, 'utf-8');
        for (const cls of extractClassesFromJs(js)) {
            classes.add(cls);
        }
    } catch {
        // No JS file — unlikely but not an error
    }

    return classes;
}

export { extractClassesFromHtml, extractClassesFromJs, isTailwindClassName };
`;
}

export function cssSplitterCssWriter() {
    return `/**
 * CSS Writer for the Tailwind CSS Splitter.
 *
 * Merges generated per-component CSS with any existing hand-written CSS
 * in the component's .css file. Uses a marker comment to delineate
 * the generated section from the hand-written section.
 */

import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const MARKER = '/* === GENERATED BY TAILWIND SPLITTER — DO NOT EDIT BELOW === */';

/**
 * Build the generated CSS string for a component.
 *
 * @param {Set<string>} usedClasses - Class names the component uses
 * @param {Map} classMap - Map from class name to array of rule entries
 * @param {string} baseString - The Tailwind CSS variable base block
 * @returns {string} The generated CSS
 */
export function buildComponentCss(usedClasses, classMap, baseString) {
    const parts = [];

    if (baseString) {
        parts.push(baseString);
    }

    const standaloneRules = [];
    const mediaGroups = new Map();

    for (const cls of usedClasses) {
        const entries = classMap.get(cls);
        if (!entries) continue;

        for (const entry of entries) {
            if (entry.wrapperName) {
                const key = \`@\${entry.wrapperName} \${entry.wrapperParams}\`;
                if (!mediaGroups.has(key)) mediaGroups.set(key, []);
                mediaGroups.get(key).push(entry.ruleText);
            } else {
                standaloneRules.push(entry.ruleText);
            }
        }
    }

    for (const rule of standaloneRules) {
        parts.push(rule);
    }

    for (const [wrapper, rules] of mediaGroups) {
        parts.push(\`\${wrapper} {\\n\${rules.join('\\n')}\\n}\`);
    }

    return parts.join('\\n');
}

/**
 * Write the generated CSS into a component's .css file,
 * preserving any hand-written CSS above the marker.
 *
 * @param {string} componentDir - Full path to the component directory
 * @param {string} componentName - The component name
 * @param {string} generatedCss - The generated Tailwind CSS to write
 * @returns {Promise<string>} The full path of the written CSS file
 */
export async function writeComponentCss(componentDir, componentName, generatedCss) {
    const cssPath = path.join(componentDir, \`\${componentName}.css\`);
    let existingContent = '';

    try {
        existingContent = await readFile(cssPath, 'utf-8');
    } catch {
        // No existing CSS file — that's fine, we'll create one
    }

    const markerIndex = existingContent.indexOf(MARKER);
    let handWritten;
    if (markerIndex !== -1) {
        handWritten = existingContent.substring(0, markerIndex).trimEnd();
    } else {
        handWritten = existingContent.trimEnd();
    }

    const output = handWritten
        ? \`\${handWritten}\\n\\n\${MARKER}\\n\${generatedCss}\\n\`
        : \`\${MARKER}\\n\${generatedCss}\\n\`;

    await writeFile(cssPath, output, 'utf-8');
    return cssPath;
}

export { MARKER };
`;
}
