/**
 * Core build pipeline: compile → split → deploy.
 *
 * Shared by `sf tailwind build`, `sf tailwind watch`, and
 * `sf tailwind component`.
 */

import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { compileCss, splitCss, type BuildResult } from './css-builder.js';
import { ensureDir } from './file-utils.js';
import type { ProjectPaths } from './project.js';

export interface TailwindBuildOptions {
  cwd: string;
  paths: ProjectPaths;
  production?: boolean;
  onlyComponents?: Set<string> | null;
}

export interface TailwindBuildResult extends BuildResult {
  baseKb: string;
  totalRules: number;
}

export interface DeployOptions {
  staticResourceDir: string;
  usernameOrConnection: string;
}

export async function tailwindBuild(options: TailwindBuildOptions): Promise<TailwindBuildResult> {
  const { cwd, paths, production = false, onlyComponents = null } = options;

  await ensureDir(paths.compiledCssPath.replace(/\/[^/]+$/, ''));
  await ensureDir(paths.staticResourceDir);

  compileCss(cwd, 'tailwind.css', paths.compiledCssPath, production);

  const buildResult = await splitCss(
    paths.compiledCssPath,
    paths.allLwcDirs,
    paths.tailwindCssPath,
    onlyComponents,
  );

  const totalRules = buildResult.results.reduce((sum, r) => sum + r.rulesIncluded, 0);
  const baseKb = (buildResult.baseBlockBytes / 1024).toFixed(1);

  return { ...buildResult, baseKb, totalRules };
}

export async function deployStaticResource(options: DeployOptions): Promise<string> {
  const componentSet = ComponentSet.fromSource(options.staticResourceDir);
  const deploy = await componentSet.deploy({ usernameOrConnection: options.usernameOrConnection });
  const result = await deploy.pollStatus();
  return result.response.status;
}
