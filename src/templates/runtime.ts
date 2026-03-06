/**
 * Runtime LWC templates: tailwindElement, tailwindUtils, static resource meta.
 */

export function tailwindElementJs(): string {
  return `import { LightningElement } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import TAILWIND from '@salesforce/resourceUrl/tailwind';

/**
 * Base class for LWC components that use Tailwind CSS.
 *
 * Loads the Tailwind CSS base variables (--tw-* custom properties)
 * from a static resource into each component's shadow root.
 * Per-component utility rules live in each component's .css file
 * and are auto-loaded by LWC.
 *
 * Uses the Template Method pattern so child classes can safely extend
 * lifecycle behavior without breaking CSS injection.
 *
 * @example
 * import TailwindElement from 'c/tailwindElement';
 *
 * export default class MyComponent extends TailwindElement {
 *     onInit() {
 *         // runs on connectedCallback
 *     }
 * }
 */
export default class TailwindElement extends LightningElement {
    _twLoaded = false;

    connectedCallback() {
        this.onInit();
    }

    renderedCallback() {
        if (!this._twLoaded) {
            this._twLoaded = true;
            loadStyle(this, TAILWIND).catch((err) => {
                console.error('[TailwindElement] Failed to load styles:', err);
            });
            this.onFirstRender();
        }
        this.onRender();
    }

    disconnectedCallback() {
        this.onDisconnect();
    }

    /** Override in child class. Runs on connectedCallback. */
    onInit() {}

    /** Override in child class. Runs once after first render. */
    onFirstRender() {}

    /** Override in child class. Runs on every render cycle. */
    onRender() {}

    /** Override in child class. Runs on disconnectedCallback. */
    onDisconnect() {}
}
`;
}

export function tailwindElementMeta(apiVersion: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${apiVersion}</apiVersion>
    <isExposed>false</isExposed>
    <description>Base class for Tailwind CSS enabled LWC components</description>
</LightningComponentBundle>
`;
}

export function tailwindUtilsJs(): string {
  return `/**
 * Utility for composing Tailwind CSS class names in LWC.
 * Works like clsx/classnames from the React ecosystem.
 *
 * @example
 * import { cn } from 'c/tailwindUtils';
 *
 * // Strings
 * cn('px-4 py-2', 'text-white')  // → 'px-4 py-2 text-white'
 *
 * // Conditionals
 * cn('base', isActive && 'bg-brand', !isActive && 'bg-gray-200')
 *
 * // Objects
 * cn('base', { 'bg-brand': isActive, 'opacity-50': isDisabled })
 *
 * // Arrays
 * cn(['px-4', 'py-2'], 'text-white')
 *
 * // Mixed
 * cn('px-4', condition && 'font-bold', { 'text-error': hasError }, ['rounded-md'])
 */
export function cn(...args) {
    const classes = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg) continue;

        if (typeof arg === 'string') {
            classes.push(arg);
        } else if (Array.isArray(arg)) {
            const inner = cn(...arg);
            if (inner) classes.push(inner);
        } else if (typeof arg === 'object') {
            const keys = Object.keys(arg);
            for (let k = 0; k < keys.length; k++) {
                if (arg[keys[k]]) {
                    classes.push(keys[k]);
                }
            }
        }
    }

    return classes.join(' ');
}
`;
}

export function tailwindUtilsMeta(apiVersion: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${apiVersion}</apiVersion>
    <isExposed>false</isExposed>
    <description>Utility functions for Tailwind CSS in LWC (cn class helper)</description>
</LightningComponentBundle>
`;
}

export function staticResourceMeta(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
    <cacheControl>Public</cacheControl>
    <contentType>text/css</contentType>
    <description>Tailwind CSS base variables (--tw-* custom properties)</description>
</StaticResource>
`;
}
