/**
 * Component scaffold templates for `lwc-tailwind component <name>`.
 */

/**
 * Convert a camelCase component name to a kebab-case tag name.
 * e.g., "myButton" → "my-button"
 */
export function toKebabCase(name) {
    return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function componentJs(name) {
    return `import TailwindElement from 'c/tailwindElement';

export default class ${name.charAt(0).toUpperCase() + name.slice(1)} extends TailwindElement {
    static useSplitCss = true;
}
`;
}

export function componentHtml(name) {
    const tag = toKebabCase(name);
    return `<template>
    <div class="p-4">
        <h2 class="text-lg font-semibold text-text-default mb-2">${tag}</h2>
        <p class="text-text-weak">Your component is ready. Start building!</p>
    </div>
</template>
`;
}

export function componentMeta(apiVersion) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${apiVersion}</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__AppPage</target>
        <target>lightning__RecordPage</target>
        <target>lightning__HomePage</target>
        <target>lightningCommunity__Page</target>
        <target>lightningCommunity__Default</target>
    </targets>
</LightningComponentBundle>
`;
}
