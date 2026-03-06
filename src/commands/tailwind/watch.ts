import path from 'node:path';
import chokidar from 'chokidar';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { readSfProject, getProjectPaths } from '../../services/project.js';
import { compileCss, splitCss } from '../../services/css-builder.js';
import { fileExists } from '../../services/file-utils.js';

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

    // Check prerequisites
    const missing: string[] = [];
    if (!(await fileExists(path.join(cwd, 'tailwind.config.js')))) missing.push('tailwind.config.js');
    if (!(await fileExists(path.join(cwd, 'postcss.config.js')))) missing.push('postcss.config.js');
    if (!(await fileExists(path.join(cwd, 'src/tailwind.css')))) missing.push('src/tailwind.css');
    if (missing.length > 0) {
      this.error(`Missing required files: ${missing.join(', ')}.\nRun "sf tailwind init" first.`);
    }

    const WATCH_EXTENSIONS = new Set(['.html', '.js', '.css']);
    const CONFIG_FILES = new Set([
      path.resolve(cwd, 'tailwind.config.js'),
      path.resolve(cwd, 'postcss.config.js'),
    ]);
    const DEBOUNCE_MS = 300;
    let splitterWrittenPaths = new Set<string>();

    const timestamp = (): string =>
      new Date().toLocaleTimeString('en-GB', { hour12: false });

    // Build function
    const build = async (): Promise<void> => {
      try {
        compileCss(cwd, 'src/tailwind.css', paths.compiledCssPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`  [${timestamp()}] CSS build failed: ${msg}`);
        return;
      }

      try {
        const { results, writtenPaths, baseBlockBytes } = await splitCss(
          paths.compiledCssPath,
          paths.lwcDir,
          paths.tailwindCssPath,
        );
        splitterWrittenPaths = new Set(writtenPaths);
        const totalRules = results.reduce((sum, r) => sum + r.rulesIncluded, 0);
        const baseKb = (baseBlockBytes / 1024).toFixed(1);
        this.log(
          `  [${timestamp()}] Built — ${results.length} components, ${totalRules} rules, base ${baseKb} KB`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`  [${timestamp()}] CSS splitting failed: ${msg}`);
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

    // Watch LWC dir, src dir, and config files
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const changedFiles = new Set<string>();

    const watcher = chokidar.watch(
      [paths.lwcDir, paths.srcDir, ...CONFIG_FILES],
      { ignoreInitial: true },
    );

    const onFileChange = (filePath: string): void => {
      const relative = path.relative(cwd, filePath);
      const ext = path.extname(filePath);
      const absPath = path.resolve(filePath);

      // Always react to config file changes
      const isConfigChange = CONFIG_FILES.has(absPath);

      if (!isConfigChange) {
        if (!WATCH_EXTENSIONS.has(ext)) return;
        if (absPath === path.resolve(paths.tailwindCssPath)) return;
        if (absPath === path.resolve(paths.compiledCssPath)) return;
        if (splitterWrittenPaths.has(absPath)) return;
      }

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
