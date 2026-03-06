import path from 'node:path';
import chokidar from 'chokidar';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { readSfProject, getProjectPaths } from '../../services/project.js';
import { compileCss, splitCss } from '../../services/css-builder.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('lwc-tailwind', 'tailwind.watch');

export default class TailwindWatch extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  // Watch runs indefinitely — don't timeout
  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const cwd = process.cwd();
    const { packageDir } = await readSfProject(cwd);
    const paths = getProjectPaths(cwd, packageDir);

    const WATCH_EXTENSIONS = new Set(['.html', '.js', '.css']);
    const DEBOUNCE_MS = 300;
    let splitterWrittenPaths = new Set<string>();

    const timestamp = (): string =>
      new Date().toLocaleTimeString('en-GB', { hour12: false });

    // Build function
    const build = async (): Promise<void> => {
      try {
        compileCss(cwd, 'src/tailwind.css', paths.tailwindCssPath);
      } catch (err) {
        this.log(`  [${timestamp()}] CSS build failed`);
        return;
      }

      try {
        const { results, writtenPaths } = await splitCss(paths.tailwindCssPath, paths.lwcDir);
        splitterWrittenPaths = new Set(writtenPaths);
        const totalRules = results.reduce((sum, r) => sum + r.rulesIncluded, 0);
        this.log(
          `  [${timestamp()}] Built — ${results.length} components, ${totalRules} rules`,
        );
      } catch (err) {
        this.log(`  [${timestamp()}] CSS splitting failed`);
      }
    };

    // Initial build
    this.log('');
    this.log('  Tailwind CSS Watcher');
    this.log('  ────────────────────');
    this.log('');
    this.log(`  [${timestamp()}] Initial build...`);
    await build();
    this.log('');
    this.log(`  [${timestamp()}] Watching for changes... (Ctrl+C to stop)`);
    this.log('');

    // Watch
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const changedFiles = new Set<string>();

    const watcher = chokidar.watch([paths.lwcDir, paths.srcDir], {
      ignoreInitial: true,
    });

    const onFileChange = (filePath: string): void => {
      const relative = path.relative(cwd, filePath);
      const ext = path.extname(filePath);

      if (!WATCH_EXTENSIONS.has(ext)) return;
      if (path.resolve(filePath) === path.resolve(paths.tailwindCssPath)) return;
      if (splitterWrittenPaths.has(path.resolve(filePath))) return;

      changedFiles.add(relative);

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const files = [...changedFiles];
        changedFiles.clear();

        for (const f of files) {
          this.log(`  [${timestamp()}] Changed: ${f}`);
        }

        await build();
      }, DEBOUNCE_MS);
    };

    watcher.on('change', onFileChange);
    watcher.on('add', onFileChange);

    // Keep alive until Ctrl+C
    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => {
        this.log('');
        this.log(`  [${timestamp()}] Stopping...`);
        void watcher.close().then(resolve);
      });
    });
  }
}
