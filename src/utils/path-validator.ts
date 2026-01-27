import { resolve, normalize, sep } from 'path';
import { lstatSync } from 'fs';

export class PathValidator {
  constructor(private safeRoot: string) {
    this.safeRoot = resolve(safeRoot);
  }

  isPathSafe(requestedPath: string): boolean {
    try {
      if (requestedPath.includes('\0')) {
        return false;
      }

      const normalizedPath = normalize(requestedPath);

      if (normalizedPath.includes('..')) {
        return false;
      }

      const resolvedPath = resolve(this.safeRoot, normalizedPath);

      if (!resolvedPath.startsWith(this.safeRoot + sep) && resolvedPath !== this.safeRoot) {
        return false;
      }

      try {
        const stats = lstatSync(resolvedPath);
        if (stats.isSymbolicLink()) {
          return false;
        }
      } catch {
        // Path doesn't exist yet, which is OK for creation operations
      }

      return true;
    } catch {
      return false;
    }
  }

  resolvePathSafely(requestedPath: string): string | null {
    if (!this.isPathSafe(requestedPath)) {
      return null;
    }

    return resolve(this.safeRoot, normalize(requestedPath));
  }

  getSafeRoot(): string {
    return this.safeRoot;
  }
}
