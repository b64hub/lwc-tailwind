# summary

Scaffold a new Tailwind-enabled LWC component.

# description

Creates a new Lightning Web Component that extends TailwindElement with per-component CSS splitting enabled. Generates JS, HTML, and meta XML files, then runs a CSS build.

# examples

- Create a new component:

  <%= config.bin %> <%= command.id %> myButton

- Create a component with a longer name:

  <%= config.bin %> <%= command.id %> productDetailCard

# args.name.summary

Component name in camelCase (e.g., myButton, productCard).
