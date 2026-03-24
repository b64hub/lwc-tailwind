import path from 'node:path';
import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { readSfProject, getProjectPaths } from '../../services/project.js';
import { addDevDeps } from '../../services/npm.js';
import { safeWriteFile, fileExists } from '../../services/file-utils.js';
import { tailwindBuild } from '../../services/build.js';
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
    'package-dir': Flags.directory({
      char: 'd',
      summary: 'Package directory where staticresources/ and lwc/ folders are located (e.g., force-app/main/default). Defaults to the detected package directory from sfdx-project.json.',
    }),
    'package-version': Flags.string({
      char: 'p',
      summary: 'Package version ID for the lwc-tailwind-bootstrap unlocked package.',
      default: BOOTSTRAP_PACKAGE_VERSION,
    }),
    'target-org': Flags.string({
      char: 'o',
      summary: 'Salesforce org where the lwc-tailwind-bootstrap package should be installed.',
      required: false,
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
    const { packageDir: detectedDir, apiVersion, project } = await readSfProject(cwd);
    const packageDir = flags['package-dir']
      ? path.relative(cwd, flags['package-dir'])
      : detectedDir;
    const paths = getProjectPaths(cwd, packageDir, project);
    this.log(`  Package directory: ${packageDir}`);
    this.log(`  API version: ${apiVersion}`);

    // 2. Add dependencies to package.json
    this.log('');
    this.log('Adding dependencies to package.json...');
    const added = await addDevDeps(USER_DEPS, cwd);
    if (added.length > 0) {
      this.log(`  Added: ${added.join(', ')}`);
    } else {
      this.log('  All dependencies already present.');
    }

    // 3. Config files at project root
    this.log('');
    this.log('Creating configuration files at project root...');
    track(await safeWriteFile(path.join(cwd, 'tailwind.config.js'), tailwindConfig()));
    track(await safeWriteFile(path.join(cwd, 'postcss.config.js'), postcssConfig()));
    track(await safeWriteFile(path.join(cwd, 'tailwind.css'), tailwindCssSource()));

    // 4. Update .forceignore and .gitignore
    const ignoreEntries = [
      '.sf/',
      '# Tailwind CSS build artifacts',
    ];
    for (const ignoreFile of ['.forceignore', '.gitignore']) {
      const ignorePath = path.join(cwd, ignoreFile);
      if (await fileExists(ignorePath)) {
        let content = await readFile(ignorePath, 'utf-8');
        let updated = false;
        for (const entry of ignoreEntries) {
          if (!content.includes(entry)) {
            const separator = content.endsWith('\n') ? '' : '\n';
            content = `${content}${separator}${entry}\n`;
            updated = true;
          }
        }
        if (updated) {
          await writeFile(ignorePath, content, 'utf-8');
          this.log(`  Updated ${ignoreFile}`);
        }
      }
    }

    // 5. Install bootstrap unlocked package (tailwindMixin, tailwindUtils, static resource)
    this.log('');
    this.log('Installing lwc-tailwind-bootstrap package...');
    const packageVersion = flags['package-version'];
    const targetOrg = flags['target-org'];
    try {
      const orgFlag = targetOrg ? `--target-org ${targetOrg}` : '';
      execSync(`sf package install --package "${packageVersion}" --wait 10 --no-prompt ${orgFlag}`.trim(), {
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
      const { results } = await tailwindBuild({ cwd, paths });
      this.log(`  Built and split into ${results.length} components`);
    } catch {
      this.log('  Skipped (no components using Tailwind classes yet)');
    }

    // Done
    this.log('');
    this.log('Tailwind CSS initialized!');
    this.log('');
    this.log('Next steps:');
    this.log('  npm install              Install the added dependencies');
    this.log('  sf tailwind watch        Start the file watcher');
    this.log('  sf tailwind component    Scaffold a new component');
    this.log('  sf tailwind build        One-off CSS build');
    this.log('');
    this.log('Configuration:');
    this.log(`  Source:  tailwind.css (PostCSS input — do not edit staticresources/tailwind.css directly)`);
    this.log(`  Output:  ${paths.tailwindCssPath} (static resource, overwritten on each build)`);
    this.log(`  Config:  tailwind.config.js, postcss.config.js`);
    this.log('');

    return { packageDir, apiVersion, filesCreated, filesSkipped };
  }
}
