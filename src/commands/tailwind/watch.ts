import path from 'node:path';
import chokidar from 'chokidar';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { readSfProject, getProjectPaths } from '../../services/project.js';
import { fileExists, ensureDir } from '../../services/file-utils.js';
import { tailwindBuild, deployStaticResource } from '../../services/build.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('lwc-tailwind', 'tailwind.watch');

export default class TailwindWatch extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  // Watch runs indefinitely — don't timeout
  public static readonly enableJsonFlag = false;

  public static readonly flags = {
    'no-deploy': Flags.boolean({
      summary: 'Disable auto-deploy of the static resource after each build.',
      default: false,
    }),
    'target-org': Flags.string({
      char: 'o',
      summary: 'Org to deploy to. Defaults to the default org.',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(TailwindWatch);
    const cwd = process.cwd();
    const { packageDir, project } = await readSfProject(cwd);
    const paths = getProjectPaths(cwd, packageDir, project);
    const shouldDeploy = !flags['no-deploy'];

    // Check prerequisites
    const missing: string[] = [];
    if (!(await fileExists(path.join(cwd, 'tailwind.config.js')))) missing.push('tailwind.config.js');
    if (!(await fileExists(path.join(cwd, 'postcss.config.js')))) missing.push('postcss.config.js');
    if (!(await fileExists(path.join(cwd, 'tailwind.css')))) missing.push('tailwind.css');
    if (missing.length > 0) {
      this.error(`Missing required files: ${missing.join(', ')}.\nRun "sf tailwind init" first.`);
    }

    const WATCH_EXTENSIONS = new Set(['.html', '.js', '.css']);
    const CONFIG_FILES = new Set([
      path.resolve(cwd, 'tailwind.config.js'),
      path.resolve(cwd, 'postcss.config.js'),
      path.resolve(cwd, 'tailwind.css'),
    ]);
    const DEBOUNCE_MS = 300;
    let splitterWrittenPaths = new Set<string>();

    // Ensure build output directories exist
    const sfDir = path.join(cwd, '.sf');
    await ensureDir(sfDir);
    await ensureDir(paths.staticResourceDir);

    // Resolve org connection for auto-deploy
    let orgUsername: string | undefined;
    if (shouldDeploy) {
      try {
        const org = flags['target-org']
          ? await Org.create({ aliasOrUsername: flags['target-org'] })
          : await Org.create();
        orgUsername = org.getUsername();
        this.log(`  Auto-deploy enabled (org: ${orgUsername})`);
      } catch {
        this.warn('Could not resolve target org — auto-deploy disabled. Use --target-org or set a default org.');
      }
    }

    const timestamp = (): string =>
      new Date().toLocaleTimeString('en-GB', { hour12: false });

    // Build function
    const build = async (): Promise<void> => {
      try {
        const { results, writtenPaths, baseKb, totalRules } = await tailwindBuild({ cwd, paths });
        splitterWrittenPaths = new Set(writtenPaths);
        this.log(
          `  [${timestamp()}] Built — ${results.length} components, ${totalRules} rules, base ${baseKb} KB`,
        );

        // Auto-deploy static resource
        if (orgUsername) {
          try {
            const status = await deployStaticResource({
              staticResourceDir: paths.staticResourceDir,
              usernameOrConnection: orgUsername,
            });
            if (status === 'Succeeded') {
              this.log(`  [${timestamp()}] Deployed static resource`);
            } else {
              this.log(`  [${timestamp()}] Deploy finished with status: ${status}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.log(`  [${timestamp()}] Deploy failed: ${msg}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`  [${timestamp()}] Build failed: ${msg}`);
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
      [...paths.allLwcDirs, ...CONFIG_FILES],
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
