import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { readSfProject, getProjectPaths } from '../../services/project.js';
import { compileCss, splitCss, type SplitResult } from '../../services/css-builder.js';
import { fileExists } from '../../services/file-utils.js';

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
  };

  public async run(): Promise<BuildResult> {
    const { flags } = await this.parse(TailwindBuild);
    const cwd = process.cwd();

    const { packageDir } = await readSfProject(cwd);
    const paths = getProjectPaths(cwd, packageDir);

    // Check prerequisites
    const missing: string[] = [];
    if (!(await fileExists(path.join(cwd, 'tailwind.config.js')))) missing.push('tailwind.config.js');
    if (!(await fileExists(path.join(cwd, 'postcss.config.js')))) missing.push('postcss.config.js');
    if (!(await fileExists(path.join(cwd, 'src/tailwind.css')))) missing.push('src/tailwind.css');
    if (missing.length > 0) {
      this.error(`Missing required files: ${missing.join(', ')}.\nRun "sf tailwind init" first.`);
    }

    // 1. Compile with PostCSS (to intermediate file)
    this.log('');
    this.log('Compiling Tailwind CSS...');
    compileCss(cwd, 'src/tailwind.css', paths.compiledCssPath, flags.production);

    // 2. Split per component + write base variables to static resource
    this.log('Splitting per component...');
    const { results, baseBlockBytes } = await splitCss(
      paths.compiledCssPath,
      paths.lwcDir,
      paths.tailwindCssPath,
    );

    // 3. Summary
    const totalRules = results.reduce((sum, r) => sum + r.rulesIncluded, 0);
    const baseKb = (baseBlockBytes / 1024).toFixed(1);
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
