import { z } from 'zod';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';
import { PathValidator } from '../../utils/path-validator.js';

export class FilesReadonlyTool extends BaseTool {
  private pathValidator: PathValidator;
  private maxFileSizeMb: number;
  private allowedExtensions: string[];

  constructor(
    logger: Logger,
    safeRoot: string,
    maxFileSizeMb: number,
    allowedExtensions: string[]
  ) {
    super(logger);
    this.pathValidator = new PathValidator(safeRoot);
    this.maxFileSizeMb = maxFileSizeMb;
    this.allowedExtensions = allowedExtensions;
  }

  getName(): string {
    return 'files_readonly';
  }

  getDescription(): string {
    return 'Read and list files in the safe directory';
  }

  getActions() {
    return {
      list: {
        description: 'List files in a directory',
        parameters: z.object({
          path: z.string().default('.'),
        }),
      },
      read: {
        description: 'Read file contents',
        parameters: z.object({
          path: z.string(),
        }),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    switch (action) {
      case 'list':
        return this.listFiles(params.path);
      case 'read':
        return this.readFile(params.path);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private listFiles(requestedPath: string): ToolExecutionResult {
    const resolvedPath = this.pathValidator.resolvePathSafely(requestedPath);

    if (!resolvedPath) {
      return {
        success: false,
        error: 'Path is outside safe directory or contains invalid characters',
      };
    }

    try {
      const entries = readdirSync(resolvedPath, { withFileTypes: true });
      const files = entries.map((entry) => {
        const fullPath = join(resolvedPath, entry.name);
        const stats = statSync(fullPath);

        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isFile() ? stats.size : undefined,
          modified: stats.mtime.getTime(),
        };
      });

      return {
        success: true,
        data: {
          path: requestedPath,
          entries: files,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to list directory: ${error.message}`,
      };
    }
  }

  private readFile(requestedPath: string): ToolExecutionResult {
    const resolvedPath = this.pathValidator.resolvePathSafely(requestedPath);

    if (!resolvedPath) {
      return {
        success: false,
        error: 'Path is outside safe directory or contains invalid characters',
      };
    }

    const ext = extname(requestedPath).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      return {
        success: false,
        error: `File extension ${ext} is not allowed`,
      };
    }

    try {
      const stats = statSync(resolvedPath);

      if (!stats.isFile()) {
        return {
          success: false,
          error: 'Path is not a file',
        };
      }

      const maxBytes = this.maxFileSizeMb * 1024 * 1024;
      if (stats.size > maxBytes) {
        return {
          success: false,
          error: `File size exceeds maximum of ${this.maxFileSizeMb}MB`,
        };
      }

      const content = readFileSync(resolvedPath, 'utf-8');

      return {
        success: true,
        data: {
          path: requestedPath,
          content,
          size: stats.size,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to read file: ${error.message}`,
      };
    }
  }
}
