/**
 * Config file templates: tailwind.config.js, postcss.config.js, tailwind.css
 */

export function tailwindConfig(): string {
  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    '**/lwc/**/*.html',
    '**/lwc/**/*.js',
    '**/aura/**/*.cmp',
    '**/aura/**/*.js'
  ],
  theme: {
    extend: {
      // Map SLDS design tokens to Tailwind using public styling hooks
      colors: {
        'brand': 'var(--slds-g-color-brand-base-50, #0176d3)',
        'brand-dark': 'var(--slds-g-color-brand-base-40, #014486)',
        'text-default': 'var(--slds-g-color-neutral-base-10, #181818)',
        'text-weak': 'var(--slds-g-color-neutral-base-30, #444)',
        'border': 'var(--slds-g-color-border-base-1, #e5e5e5)',
        'background': 'var(--slds-g-color-neutral-base-100, #fff)',
        'background-alt': 'var(--slds-g-color-neutral-base-95, #f3f3f3)',
        'error': 'var(--slds-g-color-error-base-40, #ea001e)',
        'success': 'var(--slds-g-color-success-base-40, #2e844a)',
        'warning': 'var(--slds-g-color-warning-base-50, #fe9339)',
      }
    }
  },
  // Disable preflight to avoid conflicts with SLDS base styles
  corePlugins: {
    preflight: false
  },
  plugins: []
};
`;
}

export function postcssConfig(): string {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {})
  }
};
`;
}

export function tailwindCssSource(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
}
