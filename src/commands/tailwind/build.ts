import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { readSfProject, getProjectPaths } from '../../services/project.js';
import { type SplitResult } from '../../services/css-builder.js';
import { fileExists } from '../../services/file-utils.js';
import { resolveComponentFilter } from '../../services/component-filter.js';
import { tailwindBuild } from '../../services/build.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('lwc-tailwind', 'tailwind.build');

export type BuildResult = {
  components: SplitResult[];
  totalRules: number;
  baseBlockBytes: number;
};

export default class TailwindBuild extends SfCommand<BuildResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    production: Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.production.summary'),
      default: false,
    }),
    directory: Flags.string({
      char: 'd',
      summary: 'Limit the build to a specific directory path. Can be a component (lwc/myButton), an lwc/ folder, or a package directory.',
      multiple: true,
    }),
  };

  public async run(): Promise<BuildResult> {
    const { flags } = await this.parse(TailwindBuild);
    const cwd = process.cwd();

    const { packageDir, project } = await readSfProject(cwd);
    const paths = getProjectPaths(cwd, packageDir, project);

    // Check prerequisites
    const missing: string[] = [];
    if (!(await fileExists(path.join(cwd, 'tailwind.config.js')))) missing.push('tailwind.config.js');
    if (!(await fileExists(path.join(cwd, 'postcss.config.js')))) missing.push('postcss.config.js');
    if (!(await fileExists(path.join(cwd, 'tailwind.css')))) missing.push('tailwind.css');
    if (missing.length > 0) {
      this.error(`Missing required files: ${missing.join(', ')}.\nRun "sf tailwind init" first.`);
    }

    // 1. Compile and split
    this.log('');
    this.log('Compiling Tailwind CSS...');
    const onlyComponents = flags.directory
      ? resolveComponentFilter(cwd, paths.lwcDir, flags.directory)
      : null;
    if (onlyComponents) {
      this.log(`Splitting (filtered to ${onlyComponents.size} component${onlyComponents.size === 1 ? '' : 's'})...`);
    } else {
      this.log('Splitting per component...');
    }
    const { results, baseBlockBytes, baseKb, totalRules } = await tailwindBuild({
      cwd,
      paths,
      production: flags.production,
      onlyComponents,
    });

    // 2. Summary
    this.log('');
    this.log(`  Base variables (static resource): ${baseKb} KB`);
    for (const r of results) {
      const kb = (r.outputBytes / 1024).toFixed(1);
      this.log(`  ${r.component}: ${r.rulesIncluded} rules, ${kb} KB`);
    }
    this.log('');
    this.log(`Done — ${results.length} components, ${totalRules} rules matched`);
    if (flags.production) {
      this.log('  (production mode — CSS minified)');
    }
    this.log('');

    return { components: results, totalRules, baseBlockBytes };
  }
}
