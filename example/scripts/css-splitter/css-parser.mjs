/**
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
 *   ".hover\\:bg-brand-dark:hover"    → "hover:bg-brand-dark"
 *   ".focus\\:ring-2:focus"           → "focus:ring-2"
 *   ".md\\:grid-cols-3"              → "md:grid-cols-3"
 *   ".space-y-2 > :not([hidden]) ~"  → "space-y-2"
 *   ".pb-\\[200px\\]"                → "pb-[200px]"
 *   ".mt-0\\.5"                      → "mt-0.5"
 */
function extractClassFromSelector(selector) {
    // Match the first class selector: dot followed by escaped/unescaped chars
    const match = selector.match(/\.((?:[a-zA-Z0-9_-]|\\.)+)/);
    if (!match) return null;
    // Unescape: \: → :, \[ → [, \] → ], \/ → /, \. → .
    return match[1].replace(/\\(.)/g, '$1');
}

/**
 * Check if a rule node is part of the Tailwind CSS variable base block.
 * These are rules with selectors like "*, ::before, ::after" or "::backdrop"
 * where all declarations are --tw-* custom properties.
 */
function isBaseRule(node) {
    if (node.type !== 'rule') return false;
    const sel = node.selector.replace(/\s+/g, ' ').trim();
    // Must NOT contain a class selector
    if (sel.includes('.')) return false;
    // Must contain universal selector or pseudo-elements only
    if (!(/^[*,:>\s~+\w()-]+$/.test(sel.replace(/::/g, '').replace(/:/g, '')))) return false;
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
            // e.g., @media (min-width: 768px) { .md\:grid-cols-3 { ... } }
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
    const baseString = baseNodes.map((n) => n.toString()).join('\n');

    return { baseString, classMap };
}

export { extractClassFromSelector };
