/**
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
    // Must be at least 2 chars
    if (token.length < 2) return false;
    // Reject import paths and URLs
    if (token.includes('/')) return false;
    // Reject Salesforce-specific imports
    if (token.startsWith('@')) return false;
    // Reject camelCase identifiers (JS variable names)
    if (/[a-z][A-Z]/.test(token)) return false;
    // Must start with a letter, hyphen, or modifier prefix
    // Tailwind classes: lowercase letters, digits, hyphens, colons (modifiers),
    // dots (like mt-0.5), brackets (arbitrary values), slashes (opacity)
    return /^[a-z!-][\w./:[\]-]*$/.test(token);
}

/**
 * Extract class names from an HTML template.
 * Matches class="..." attributes and splits by whitespace.
 */
function extractClassesFromHtml(html) {
    const classes = new Set();
    // Match class="value" or class='value'
    const regex = /class\s*=\s*["']([^"']+)["']/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        for (const cls of match[1].split(/\s+/)) {
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
    // Match single-quoted and double-quoted string literals
    const stringRegex = /(?:'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)")/g;
    let match;
    while ((match = stringRegex.exec(jsSource)) !== null) {
        const str = match[1] ?? match[2];
        if (!str) continue;
        for (const token of str.split(/\s+/)) {
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

    const htmlPath = path.join(componentDir, `${componentName}.html`);
    const jsPath = path.join(componentDir, `${componentName}.js`);

    // Read HTML template
    try {
        const html = await readFile(htmlPath, 'utf-8');
        for (const cls of extractClassesFromHtml(html)) {
            classes.add(cls);
        }
    } catch {
        // No HTML file — that's fine (some components are JS-only)
    }

    // Read JS file
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
