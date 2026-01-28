import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';
import { PathValidator } from '../../utils/path-validator.js';

const MAX_CONTENT_LENGTH = 200_000;

export class FilesWriteTool extends BaseTool {
  private pathValidator: PathValidator;
  private maxFileSizeMb: number;
  private backupEnabled: boolean;
  private backupDirName: string;

  constructor(
    logger: Logger,
    safeRoot: string,
    maxFileSizeMb: number,
    backupEnabled: boolean,
    backupDirName: string
  ) {
    super(logger);
    this.pathValidator = new PathValidator(safeRoot);
    this.maxFileSizeMb = maxFileSizeMb;
    this.backupEnabled = backupEnabled;
    this.backupDirName = backupDirName;
  }

  getName(): string {
    return 'files_write';
  }

  getDescription(): string {
    return 'Write, edit, and delete files inside the safe directory';
  }

  getActions() {
    return {
      write: {
        description: 'Write content to a file',
        parameters: z.object({
          path: z.string(),
          content: z.string().max(MAX_CONTENT_LENGTH),
          create_dirs: z.boolean().optional().default(true),
          overwrite: z.boolean().optional().default(true),
        }),
      },
      append: {
        description: 'Append content to a file',
        parameters: z.object({
          path: z.string(),
          content: z.string().max(MAX_CONTENT_LENGTH),
        }),
      },
      edit: {
        description: 'Edit file by replacing text',
        parameters: z.object({
          path: z.string(),
          old_text: z.string(),
          new_text: z.string(),
          replace_all: z.boolean().optional().default(false),
        }),
      },
      delete: {
        description: 'Delete a file',
        parameters: z.object({
          path: z.string(),
        }),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    switch (action) {
      case 'write':
        return this.writeFile(params.path, params.content, params.create_dirs, params.overwrite);
      case 'append':
        return this.appendFile(params.path, params.content);
      case 'edit':
        return this.editFile(params.path, params.old_text, params.new_text, params.replace_all);
      case 'delete':
        return this.deleteFile(params.path);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private resolvePath(requestedPath: string): string | null {
    return this.pathValidator.resolvePathSafely(requestedPath);
  }

  private async writeFile(
    requestedPath: string,
    content: string,
    createDirs: boolean,
    overwrite: boolean
  ): Promise<ToolExecutionResult> {
    const resolvedPath = this.resolvePath(requestedPath);
    if (!resolvedPath) {
      return { success: false, error: 'Path is outside safe directory or contains invalid characters' };
    }

    if (createDirs) {
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    }

    const exists = await this.fileExists(resolvedPath);
    if (exists && !overwrite) {
      return { success: false, error: 'File already exists and overwrite=false' };
    }

    if (exists) {
      await this.backupFile(resolvedPath);
    }

    if (!this.isSizeAllowed(content.length)) {
      return { success: false, error: `Content exceeds maximum of ${this.maxFileSizeMb}MB` };
    }

    await fs.writeFile(resolvedPath, content, 'utf-8');
    return { success: true, data: { path: resolvedPath, size: content.length } };
  }

  private async appendFile(requestedPath: string, content: string): Promise<ToolExecutionResult> {
    const resolvedPath = this.resolvePath(requestedPath);
    if (!resolvedPath) {
      return { success: false, error: 'Path is outside safe directory or contains invalid characters' };
    }

    if (!this.isSizeAllowed(content.length)) {
      return { success: false, error: `Content exceeds maximum of ${this.maxFileSizeMb}MB` };
    }

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.appendFile(resolvedPath, content, 'utf-8');
    return { success: true, data: { path: resolvedPath } };
  }

  private async editFile(
    requestedPath: string,
    oldText: string,
    newText: string,
    replaceAll: boolean
  ): Promise<ToolExecutionResult> {
    const resolvedPath = this.resolvePath(requestedPath);
    if (!resolvedPath) {
      return { success: false, error: 'Path is outside safe directory or contains invalid characters' };
    }

    const content = await fs.readFile(resolvedPath, 'utf-8');
    if (!content.includes(oldText)) {
      return { success: false, error: 'Old text not found in file' };
    }

    const replacements = replaceAll ? content.split(oldText).length - 1 : 1;
    const updated = replaceAll ? content.replaceAll(oldText, newText) : content.replace(oldText, newText);

    await this.backupFile(resolvedPath);
    await fs.writeFile(resolvedPath, updated, 'utf-8');

    return {
      success: true,
      data: { path: resolvedPath, replacements },
    };
  }

  private async deleteFile(requestedPath: string): Promise<ToolExecutionResult> {
    const resolvedPath = this.resolvePath(requestedPath);
    if (!resolvedPath) {
      return { success: false, error: 'Path is outside safe directory or contains invalid characters' };
    }

    const exists = await this.fileExists(resolvedPath);
    if (!exists) {
      return { success: false, error: 'File not found' };
    }

    await this.backupFile(resolvedPath);
    await fs.unlink(resolvedPath);
    return { success: true, data: { path: resolvedPath } };
  }

  private async backupFile(resolvedPath: string): Promise<void> {
    if (!this.backupEnabled) return;

    try {
      const backupDir = path.join(this.pathValidator.getSafeRoot(), this.backupDirName);
      await fs.mkdir(backupDir, { recursive: true });
      const base = path.basename(resolvedPath);
      const backupPath = path.join(backupDir, `${base}.${Date.now()}.bak`);
      await fs.copyFile(resolvedPath, backupPath);
    } catch (error: any) {
      this.logger.warn({ error, path: resolvedPath }, 'Failed to create backup');
    }
  }

  private async fileExists(resolvedPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(resolvedPath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  private isSizeAllowed(length: number): boolean {
    const maxBytes = this.maxFileSizeMb * 1024 * 1024;
    return length <= maxBytes;
  }
}
