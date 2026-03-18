import path from 'node:path';
import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { readSfProject, getProjectPaths } from '../../services/project.js';
import { installDevDeps } from '../../services/npm.js';
import { safeWriteFile, ensureDir, fileExists } from '../../services/file-utils.js';
import { compileCss, splitCss } from '../../services/css-builder.js';
import { tailwindConfig, postcssConfig, tailwindCssSource } from '../../templates/configs.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('lwc-tailwind', 'tailwind.init');

const USER_DEPS = ['tailwindcss@3', 'postcss', 'postcss-cli', 'autoprefixer', 'cssnano'];

/** Package version ID for the lwc-tailwind-bootstrap unlocked package. */
const BOOTSTRAP_PACKAGE_VERSION = '04tXXXXXXXXXXXXXXX';

export type InitResult = {
  packageDir: string;
  apiVersion: string;
  filesCreated: string[];
  filesSkipped: string[];
};

export default class TailwindInit extends SfCommand<InitResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
    }),
    'package-version': Flags.string({
      char: 'p',
      summary: 'Package version ID for the lwc-tailwind-bootstrap unlocked package.',
      default: BOOTSTRAP_PACKAGE_VERSION,
    }),
  };

  public async run(): Promise<InitResult> {
    const { flags } = await this.parse(TailwindInit);
    const cwd = process.cwd();
    const filesCreated: string[] = [];
    const filesSkipped: string[] = [];

    const track = (result: { created: boolean; skipped: boolean; path: string }): void => {
      if (result.created) {
        this.log(`  Created ${result.path}`);
        filesCreated.push(result.path);
      } else if (result.skipped) {
        this.log(`  Skipped ${result.path} (already exists)`);
        filesSkipped.push(result.path);
      }
    };

    // 1. Read project config
    this.log('');
    this.log('Reading project configuration...');
    const { packageDir: detectedDir, apiVersion } = await readSfProject(cwd);
    const packageDir = flags['output-dir']
      ? path.relative(cwd, flags['output-dir'])
      : detectedDir;
    const paths = getProjectPaths(cwd, packageDir);
    this.log(`  Package directory: ${packageDir}`);
    this.log(`  API version: ${apiVersion}`);

    // 2. Install dependencies
    this.log('');
    this.log('Installing dependencies...');
    installDevDeps(USER_DEPS, cwd);

    // 3. Config files
    this.log('');
    this.log('Creating configuration files...');
    track(await safeWriteFile(path.join(cwd, 'tailwind.config.js'), tailwindConfig()));
    track(await safeWriteFile(path.join(cwd, 'postcss.config.js'), postcssConfig()));
    await ensureDir(paths.srcDir);
    track(await safeWriteFile(path.join(paths.srcDir, 'tailwind.css'), tailwindCssSource()));

    // 4. Update .forceignore and .gitignore
    const ignoreEntry = 'src/.tailwind-compiled.css';
    for (const ignoreFile of ['.forceignore', '.gitignore']) {
      const ignorePath = path.join(cwd, ignoreFile);
      if (await fileExists(ignorePath)) {
        const content = await readFile(ignorePath, 'utf-8');
        if (!content.includes(ignoreEntry)) {
          const separator = content.endsWith('\n') ? '' : '\n';
          await writeFile(ignorePath, `${content}${separator}\n# Tailwind CSS intermediate build\n${ignoreEntry}\n`, 'utf-8');
          this.log(`  Updated ${ignoreFile}`);
        }
      }
    }

    // 5. Install bootstrap unlocked package (tailwindMixin, tailwindUtils, static resource)
    this.log('');
    this.log('Installing lwc-tailwind-bootstrap package...');
    const packageVersion = flags['package-version'];
    try {
      execSync(`sf package install --package "${packageVersion}" --wait 10 --no-prompt`, {
        cwd,
        stdio: 'inherit',
      });
      this.log('  Bootstrap package installed.');
    } catch (error) {
      this.warn(`Failed to install bootstrap package (${packageVersion}). You may need to install it manually.`);
    }

    // 6. Initial build
    this.log('');
    this.log('Running initial CSS build...');
    try {
      compileCss(cwd, 'src/tailwind.css', paths.compiledCssPath);
      const { results } = await splitCss(paths.compiledCssPath, paths.lwcDir, paths.tailwindCssPath);
      this.log(`  Built and split into ${results.length} components`);
    } catch {
      this.log('  Skipped (no components using Tailwind classes yet)');
    }

    // Done
    this.log('');
    this.log('Tailwind CSS initialized!');
    this.log('');
    this.log('Next steps:');
    this.log('  sf tailwind watch        Start the file watcher');
    this.log('  sf tailwind component    Scaffold a new component');
    this.log('  sf tailwind build        One-off CSS build');
    this.log('');

    return { packageDir, apiVersion, filesCreated, filesSkipped };
  }
}
