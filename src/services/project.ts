/**
 * Salesforce project detection and configuration.
 *
 * Wraps @salesforce/core SfProject to resolve package directories
 * and derive standard directory paths.
 */

import path from 'node:path';
import { existsSync } from 'node:fs';
import { SfProject } from '@salesforce/core';

const DEFAULT_API_VERSION = '65.0';

export interface SfProjectConfig {
  packageDir: string;
  apiVersion: string;
  project: SfProject;
}

export interface ProjectPaths {
  /** Primary lwc dir (from the target package directory). */
  lwcDir: string;
  /** All lwc dirs across every package directory in sfdx-project.json. */
  allLwcDirs: string[];
  staticResourceDir: string;
  tailwindCssPath: string;
  compiledCssPath: string;
}

export async function readSfProject(cwd: string): Promise<SfProjectConfig> {
  const project = await SfProject.resolve(cwd);
  const defaultPackage = project.getDefaultPackage();
  const packageDir = defaultPackage.path;

  const config = await project.resolveProjectConfig();
  const apiVersion = (config.sourceApiVersion as string) ?? DEFAULT_API_VERSION;

  return { packageDir, apiVersion, project };
}

export function getProjectPaths(cwd: string, packageDir: string, project?: SfProject): ProjectPaths {
  const base = resolveMetadataRoot(cwd, packageDir);

  // Collect lwc dirs from all package directories
  const allLwcDirs: string[] = [];
  if (project) {
    for (const pkg of project.getUniquePackageDirectories()) {
      const pkgBase = resolveMetadataRoot(cwd, pkg.path);
      const lwc = path.join(pkgBase, 'lwc');
      if (existsSync(lwc)) {
        allLwcDirs.push(lwc);
      }
    }
  }
  // Ensure the primary lwcDir is always included
  const primaryLwc = path.join(base, 'lwc');
  if (!allLwcDirs.includes(primaryLwc)) {
    allLwcDirs.push(primaryLwc);
  }

  return {
    lwcDir: primaryLwc,
    allLwcDirs,
    staticResourceDir: path.join(base, 'staticresources'),
    tailwindCssPath: path.join(base, 'staticresources/tailwind.css'),
    compiledCssPath: path.join(cwd, '.sf/tailwind.css'),
  };
}

/**
 * Resolve the directory that contains lwc/, staticresources/, etc.
 * Prefers `{packageDir}/lwc` (flat layout) and falls back to
 * `{packageDir}/main/default` (standard SFDX layout).
 */
function resolveMetadataRoot(cwd: string, packageDir: string): string {
  const flat = path.join(cwd, packageDir);
  if (existsSync(path.join(flat, 'lwc'))) {
    return flat;
  }
  const nested = path.join(cwd, packageDir, 'main/default');
  if (existsSync(path.join(nested, 'lwc'))) {
    return nested;
  }
  // Default to flat layout — directories will be created later
  return flat;
}
