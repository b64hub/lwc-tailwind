/**
 * Resolve --directory flag values into a set of component names to include.
 *
 * Accepts paths like:
 *   - lwc/myButton          → includes "myButton"
 *   - force-app/main/default/lwc/myButton → includes "myButton"
 *   - force-app/main/default/lwc          → includes all components under that lwc/
 *   - force-app/main/default              → includes all components under its lwc/
 *   - myButton              → treated as a component name directly
 */

import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

export function resolveComponentFilter(
  cwd: string,
  defaultLwcDir: string,
  directories: string[],
): Set<string> {
  const names = new Set<string>();

  for (const dir of directories) {
    const abs = path.isAbsolute(dir) ? dir : path.resolve(cwd, dir);

    // If it's a directory under lwc/, treat it as a component name
    if (abs.startsWith(defaultLwcDir + path.sep) || abs === defaultLwcDir) {
      if (abs === defaultLwcDir) {
        // Pointing at the lwc dir itself — include all
        addAllComponents(defaultLwcDir, names);
      } else {
        // Pointing at a specific component under lwc/
        names.add(path.basename(abs));
      }
      continue;
    }

    // Check if path has an lwc/ subdirectory
    const lwcSubdir = path.join(abs, 'lwc');
    if (existsSync(lwcSubdir)) {
      addAllComponents(lwcSubdir, names);
      continue;
    }

    // Check for main/default/lwc pattern
    const nestedLwc = path.join(abs, 'main/default/lwc');
    if (existsSync(nestedLwc)) {
      addAllComponents(nestedLwc, names);
      continue;
    }

    // Treat as a bare component name
    names.add(path.basename(abs));
  }

  return names;
}

function addAllComponents(lwcDir: string, names: Set<string>): void {
  if (!existsSync(lwcDir)) return;
  for (const entry of readdirSync(lwcDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      names.add(entry.name);
    }
  }
}
