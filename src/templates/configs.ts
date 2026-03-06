/**
 * Config file templates: tailwind.config.js, postcss.config.js, src/tailwind.css
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
      // Map SLDS design tokens to Tailwind so they cross Shadow DOM boundaries
      colors: {
        'brand': 'var(--lwc-colorBrand, #0176d3)',
        'brand-dark': 'var(--lwc-colorBrandDark, #014486)',
        'text-default': 'var(--lwc-colorTextDefault, #181818)',
        'text-weak': 'var(--lwc-colorTextWeak, #444)',
        'border': 'var(--lwc-colorBorder, #e5e5e5)',
        'background': 'var(--lwc-colorBackground, #fff)',
        'background-alt': 'var(--lwc-colorBackgroundAlt, #f3f3f3)',
        'error': 'var(--lwc-colorTextError, #ea001e)',
        'success': 'var(--lwc-colorTextSuccess, #2e844a)',
        'warning': 'var(--lwc-colorTextWarning, #fe9339)',
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
