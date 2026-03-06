import path from 'node:path';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Args } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { readSfProject, getProjectPaths } from '../../services/project.js';
import { fileExists, ensureDir, safeWriteFile } from '../../services/file-utils.js';
import { compileCss, splitCss } from '../../services/css-builder.js';
import { componentJs, componentHtml, componentMeta, toKebabCase } from '../../templates/component.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('lwc-tailwind', 'tailwind.component');

const NAME_REGEX = /^[a-z][a-zA-Z0-9]*$/;

export type ComponentResult = {
  name: string;
  tag: string;
  files: string[];
};

export default class TailwindComponent extends SfCommand<ComponentResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    name: Args.string({
      description: messages.getMessage('args.name.summary'),
      required: true,
    }),
  };

  public async run(): Promise<ComponentResult> {
    const { args } = await this.parse(TailwindComponent);
    const componentName = args.name as string;
    const cwd = process.cwd();

    // Validate name
    if (!NAME_REGEX.test(componentName)) {
      this.error(
        `Invalid component name "${componentName}". Use camelCase starting with a lowercase letter (e.g., "myButton").`,
      );
    }

    const { packageDir, apiVersion } = await readSfProject(cwd);
    const paths = getProjectPaths(cwd, packageDir);

    // Check if exists
    const componentDir = path.join(paths.lwcDir, componentName);
    if (await fileExists(componentDir)) {
      this.error(
        `Component "${componentName}" already exists at ${path.relative(cwd, componentDir)}.`,
      );
    }

    // Create files
    this.log('');
    this.log(`Creating component: ${componentName}`);
    await ensureDir(componentDir);

    const files: string[] = [];

    const jsResult = await safeWriteFile(
      path.join(componentDir, `${componentName}.js`),
      componentJs(componentName),
      { force: true },
    );
    this.log(`  Created ${jsResult.path}`);
    files.push(jsResult.path);

    const htmlResult = await safeWriteFile(
      path.join(componentDir, `${componentName}.html`),
      componentHtml(componentName),
      { force: true },
    );
    this.log(`  Created ${htmlResult.path}`);
    files.push(htmlResult.path);

    const metaResult = await safeWriteFile(
      path.join(componentDir, `${componentName}.js-meta.xml`),
      componentMeta(apiVersion),
      { force: true },
    );
    this.log(`  Created ${metaResult.path}`);
    files.push(metaResult.path);

    // Build CSS
    this.log('');
    this.log('Generating per-component CSS...');
    try {
      compileCss(cwd, 'src/tailwind.css', paths.tailwindCssPath);
      await splitCss(paths.tailwindCssPath, paths.lwcDir);
      this.log('  CSS generated');
    } catch {
      this.log('  CSS build skipped — run `sf tailwind build` manually');
    }

    // Success
    const tag = `c-${toKebabCase(componentName)}`;
    this.log('');
    this.log(`Component created! Use in templates: <${tag}></${tag}>`);
    this.log('');

    return { name: componentName, tag, files };
  }
}
