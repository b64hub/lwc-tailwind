# lwc-tailwind

Salesforce CLI plugin that brings Tailwind CSS to Lightning Web Components.

## How It Works

LWC uses Shadow DOM, which blocks regular stylesheets. This plugin works around that with a two-layer approach:

1. **Base variables** (`--tw-*` custom properties) are stored in a single static resource and injected into each component's shadow root via `loadStyle`
2. **Utility classes** are split per-component — each LWC gets only the Tailwind rules it actually uses, written into its `.css` file

The result: full Tailwind CSS support inside Shadow DOM, with SLDS design token integration out of the box.

## Install

```bash
sf plugins install lwc-tailwind
```

## Quick Start

```bash
# Initialize Tailwind in your Salesforce project
sf tailwind init

# Create a component
sf tailwind component myButton

# Start the watcher (rebuilds on file changes)
sf tailwind watch
```

## Commands

### `sf tailwind init`

Sets up Tailwind CSS in your Salesforce project:
- Installs npm dependencies (tailwindcss, postcss, autoprefixer, cssnano)
- Creates `tailwind.config.js` and `postcss.config.js` with SLDS-aware defaults
- Creates `src/tailwind.css` source file
- Scaffolds runtime LWCs (`tailwindElement` base class, `tailwindUtils` with `cn()` helper)
- Creates the static resource and metadata

### `sf tailwind build`

Compiles Tailwind CSS and generates per-component CSS files.

```bash
sf tailwind build              # Development build
sf tailwind build --production # Minified production build
```

### `sf tailwind watch`

Watches for file changes and rebuilds automatically. Monitors LWC files (`.html`, `.js`, `.css`), `src/tailwind.css`, and config files.

```bash
sf tailwind watch
```

### `sf tailwind component <name>`

Scaffolds a new LWC that extends `TailwindElement`.

```bash
sf tailwind component productCard
```

## Usage

Components extend `TailwindElement` instead of `LightningElement`:

```javascript
import TailwindElement from 'c/tailwindElement';

export default class MyButton extends TailwindElement {
}
```

Use Tailwind classes in templates:

```html
<template>
    <button class="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-dark">
        Click me
    </button>
</template>
```

### SLDS Design Tokens

The default `tailwind.config.js` maps SLDS design tokens to Tailwind colors, so they work across Shadow DOM:

| Tailwind Class | SLDS Token | Fallback |
|---|---|---|
| `bg-brand` | `--lwc-colorBrand` | `#0176d3` |
| `text-text-default` | `--lwc-colorTextDefault` | `#181818` |
| `border-border` | `--lwc-colorBorder` | `#e5e5e5` |
| `bg-error` | `--lwc-colorTextError` | `#ea001e` |
| `bg-success` | `--lwc-colorTextSuccess` | `#2e844a` |

### `cn()` Utility

A classnames/clsx-style helper for conditional classes:

```javascript
import { cn } from 'c/tailwindUtils';

// Conditionals
cn('px-4 py-2', isActive && 'bg-brand', !isActive && 'bg-background-alt')

// Objects
cn('base', { 'bg-brand': isActive, 'opacity-50': isDisabled })
```

## Development Workflow

Run the watcher in one terminal, source tracking in another:

```bash
# Terminal 1: Watch and rebuild CSS
sf tailwind watch

# Terminal 2: Deploy changes to org
sf project deploy start --source-dir force-app
```

## License

MIT
