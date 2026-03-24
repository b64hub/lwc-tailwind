import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Args } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { readSfProject, getProjectPaths } from '../../services/project.js';
import { fileExists, ensureDir, safeWriteFile } from '../../services/file-utils.js';
import { tailwindBuild } from '../../services/build.js';
import { componentTs, componentJs, componentHtml, componentMeta, toKebabCase } from '../../templates/component.js';

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

  public static readonly flags = {
    js: Flags.boolean({
      summary: 'Generate a JavaScript component instead of TypeScript.',
      default: false,
    }),
  };

  public static readonly args = {
    name: Args.string({
      description: messages.getMessage('args.name.summary'),
      required: true,
    }),
  };

  public async run(): Promise<ComponentResult> {
    const { args, flags } = await this.parse(TailwindComponent);
    const componentName = args.name as string;
    const cwd = process.cwd();
    const useTs = !flags.js;
    const ext = useTs ? 'ts' : 'js';

    // Validate name
    if (!NAME_REGEX.test(componentName)) {
      this.error(
        `Invalid component name "${componentName}". Use camelCase starting with a lowercase letter (e.g., "myButton").`,
      );
    }

    const { packageDir, apiVersion, project } = await readSfProject(cwd);
    const paths = getProjectPaths(cwd, packageDir, project);

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

    const scriptResult = await safeWriteFile(
      path.join(componentDir, `${componentName}.${ext}`),
      useTs ? componentTs(componentName) : componentJs(componentName),
      { force: true },
    );
    this.log(`  Created ${scriptResult.path}`);
    files.push(scriptResult.path);

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
      await tailwindBuild({ cwd, paths });
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
