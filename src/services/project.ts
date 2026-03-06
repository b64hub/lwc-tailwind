/**
 * Salesforce project detection and configuration.
 *
 * Reads sfdx-project.json to determine packageDir and apiVersion,
 * and derives standard directory paths from that.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface SfProjectConfig {
  packageDir: string;
  apiVersion: string;
  raw: Record<string, unknown>;
}

export interface ProjectPaths {
  lwcDir: string;
  staticResourceDir: string;
  srcDir: string;
  tailwindCssPath: string;
}

export async function readSfProject(cwd: string): Promise<SfProjectConfig> {
  const projectPath = path.join(cwd, 'sfdx-project.json');

  let raw: Record<string, unknown>;
  try {
    const content = await readFile(projectPath, 'utf-8');
    raw = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error(
      'No sfdx-project.json found. Are you in a Salesforce project directory?'
    );
  }

  // Extract the default package directory
  let packageDir = 'force-app';
  const packageDirectories = raw.packageDirectories as Array<Record<string, unknown>> | undefined;
  if (packageDirectories?.[0]?.path) {
    packageDir = packageDirectories[0].path as string;
  }

  // Extract API version
  let apiVersion = '62.0';
  if (raw.sourceApiVersion) {
    apiVersion = raw.sourceApiVersion as string;
  }

  return { packageDir, apiVersion, raw };
}

export function getProjectPaths(cwd: string, packageDir: string): ProjectPaths {
  return {
    lwcDir: path.join(cwd, packageDir, 'main/default/lwc'),
    staticResourceDir: path.join(cwd, packageDir, 'main/default/staticresources'),
    srcDir: path.join(cwd, 'src'),
    tailwindCssPath: path.join(cwd, packageDir, 'main/default/staticresources/tailwind.css'),
  };
}
