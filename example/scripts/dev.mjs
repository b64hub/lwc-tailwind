/**
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
    'force-app/main/default/lwc',
    'src'
];

// Only react to these file extensions
const WATCH_EXTENSIONS = new Set(['.html', '.js', '.css']);

// Files to ignore (these are generated, not hand-edited)
const IGNORE_FILE = 'force-app/main/default/staticresources/tailwind.css';

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
    console.log(`  [${timestamp()}] ${msg}`);
}

function logError(msg) {
    console.error(`  [${timestamp()}] ${msg}`);
}

/**
 * Rebuilds Tailwind CSS by running PostCSS.
 * This is the same as running `npm run build:css` manually.
 * Returns true if the build succeeded.
 */
function buildCSS() {
    try {
        execSync('npx postcss src/tailwind.css -o force-app/main/default/staticresources/tailwind.css', {
            stdio: 'pipe' // capture output instead of printing it
        });
        return true;
    } catch (err) {
        logError('CSS build failed:');
        // Show the PostCSS error message so you can fix the issue
        console.error(err.stderr?.toString() || err.message);
        return false;
    }
}

/**
 * Deploys changed files to the Salesforce org.
 * This is the same as running `sf project deploy start` manually.
 */
function deploy() {
    try {
        execSync('sf project deploy start --source-dir force-app --ignore-conflicts 2>&1', {
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
        log(`Split into ${results.length} components`);
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
//
// chokidar is a file watcher library. It monitors the file system
// and calls our function whenever a file is created, changed, or deleted.
//
// Options explained:
//   ignoreInitial: true  — don't trigger for files that already exist
//   ignored: [...]       — skip node_modules and our build output
//   awaitWriteFinish     — wait until the file is fully written before triggering
//                          (prevents acting on half-written files)

let debounceTimer = null;
let changedFiles = new Set();

const watcher = chokidar.watch(WATCH_DIRS, {
    ignoreInitial: true,
    recursive: true
});

/**
 * Called when a file changes. Instead of rebuilding immediately,
 * we "debounce" — wait 300ms for more changes to come in.
 * This way, saving 5 files triggers only 1 rebuild+deploy.
 */
function onFileChange(filePath) {
    const relative = path.relative(process.cwd(), filePath);
    const ext = path.extname(filePath);

    // Only react to .html, .js, .css files
    if (!WATCH_EXTENSIONS.has(ext)) return;

    // Ignore our own build output (would cause infinite loop)
    if (relative === IGNORE_FILE) return;

    // Ignore files written by the CSS splitter
    if (splitterWrittenPaths.has(path.resolve(process.cwd(), relative))) return;

    changedFiles.add(relative);

    // Clear any existing timer and start a new one
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
        const files = [...changedFiles];
        changedFiles.clear();

        // Show which files changed
        for (const f of files) {
            log(`Changed: ${f}`);
        }

        const start = Date.now();

        // Always rebuild CSS — a template change might use new Tailwind classes
        log('Rebuilding CSS...');
        if (!buildCSS()) {
            logError('Skipping deploy (CSS build failed)');
            console.log('');
            return;
        }

        // Split CSS per component
        log('Splitting CSS per component...');
        try {
            const { results, writtenPaths } = await splitCss();
            // Track written files so watcher ignores them
            splitterWrittenPaths = new Set(writtenPaths);
            const total = results.reduce((sum, r) => sum + r.rulesIncluded, 0);
            log(`Split into ${results.length} components (${total} rules matched)`);
        } catch (err) {
            logError('CSS splitting failed:');
            console.error(err.message);
        }

        // Deploy to org
        log('Deploying to org...');
        if (deploy()) {
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            log(`Done (${elapsed}s)`);
        }
        console.log('');
    }, DEBOUNCE_MS);
}

// Listen for file changes
watcher.on('change', onFileChange);
watcher.on('add', onFileChange);
watcher.on('unlink', (filePath) => {
    log(`Deleted: ${path.relative(process.cwd(), filePath)}`);
});

// Clean shutdown when you press Ctrl+C
process.on('SIGINT', () => {
    console.log('');
    log('Stopping...');
    watcher.close();
    process.exit(0);
});
