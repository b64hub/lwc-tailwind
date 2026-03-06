# summary

Compile Tailwind CSS and split per component.

# description

Runs PostCSS to compile Tailwind CSS, then parses the output and generates per-component CSS files containing only the rules each component uses.

# examples

- Build CSS for the current project:

  <%= config.bin %> <%= command.id %>

- Build with minification for production:

  <%= config.bin %> <%= command.id %> --production

# flags.production.summary

Minify the CSS output using cssnano.
