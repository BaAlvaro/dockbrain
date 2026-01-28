import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, readFile, readdir, stat } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { FilesWriteTool } from '../../../src/tools/files-write/tool.js';
import { createLogger } from '../../../src/utils/logger.js';

describe('FilesWriteTool', () => {
  const logger = createLogger();
  let safeRoot: string;
  let tool: FilesWriteTool;

  beforeEach(async () => {
    safeRoot = await mkdtemp(path.join(tmpdir(), 'dockbrain-write-'));
    tool = new FilesWriteTool(logger, safeRoot, 10, true, '.backups');
  });

  it('writes and appends content', async () => {
    const writeResult = await tool.execute('write', { path: 'note.txt', content: 'hello' }, { user_id: 1, task_id: 't1' });
    expect(writeResult.success).toBe(true);

    const appendResult = await tool.execute('append', { path: 'note.txt', content: '\nworld' }, { user_id: 1, task_id: 't2' });
    expect(appendResult.success).toBe(true);

    const content = await readFile(path.join(safeRoot, 'note.txt'), 'utf-8');
    expect(content).toContain('hello');
    expect(content).toContain('world');
  });

  it('edits content and creates a backup', async () => {
    await tool.execute('write', { path: 'edit.txt', content: 'hola mundo' }, { user_id: 1, task_id: 't3' });
    const editResult = await tool.execute(
      'edit',
      { path: 'edit.txt', old_text: 'mundo', new_text: 'dockbrain', replace_all: false },
      { user_id: 1, task_id: 't4' }
    );
    expect(editResult.success).toBe(true);

    const content = await readFile(path.join(safeRoot, 'edit.txt'), 'utf-8');
    expect(content).toContain('dockbrain');

    const backupsDir = path.join(safeRoot, '.backups');
    const backups = await readdir(backupsDir);
    expect(backups.length).toBeGreaterThan(0);
    const backupStats = await stat(path.join(backupsDir, backups[0]));
    expect(backupStats.isFile()).toBe(true);
  });
});
