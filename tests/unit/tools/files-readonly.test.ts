import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { FilesReadonlyTool } from '../../../src/tools/files-readonly/tool.js';
import { createLogger } from '../../../src/utils/logger.js';
import { tmpdir } from 'os';

describe('Files Readonly Tool', () => {
  let tool: FilesReadonlyTool;
  let safeRoot: string;
  let logger: any;

  beforeEach(() => {
    safeRoot = join(tmpdir(), 'dockbrain-test-' + Date.now());
    mkdirSync(safeRoot, { recursive: true });

    logger = createLogger();
    tool = new FilesReadonlyTool(logger, safeRoot, 10, ['.txt', '.md', '.json']);

    writeFileSync(join(safeRoot, 'test.txt'), 'Hello World');
    writeFileSync(join(safeRoot, 'test.json'), '{"key": "value"}');

    mkdirSync(join(safeRoot, 'subdir'));
    writeFileSync(join(safeRoot, 'subdir', 'nested.txt'), 'Nested content');
  });

  afterEach(() => {
    if (existsSync(join(safeRoot, 'test.txt'))) {
      unlinkSync(join(safeRoot, 'test.txt'));
    }
    if (existsSync(join(safeRoot, 'test.json'))) {
      unlinkSync(join(safeRoot, 'test.json'));
    }
    if (existsSync(join(safeRoot, 'subdir', 'nested.txt'))) {
      unlinkSync(join(safeRoot, 'subdir', 'nested.txt'));
    }
    if (existsSync(join(safeRoot, 'subdir'))) {
      rmdirSync(join(safeRoot, 'subdir'));
    }
    if (existsSync(safeRoot)) {
      rmdirSync(safeRoot);
    }
  });

  it('should list files in directory', async () => {
    const result = await tool.execute('list', { path: '.' }, {
      user_id: 1,
      task_id: 'test_task',
    });

    expect(result.success).toBe(true);
    expect(result.data?.entries).toBeDefined();
    expect(result.data?.entries.length).toBeGreaterThan(0);
  });

  it('should read file content', async () => {
    const result = await tool.execute('read', { path: 'test.txt' }, {
      user_id: 1,
      task_id: 'test_task',
    });

    expect(result.success).toBe(true);
    expect(result.data?.content).toBe('Hello World');
  });

  it('should reject path traversal attempts', async () => {
    const result = await tool.execute('read', { path: '../../../etc/passwd' }, {
      user_id: 1,
      task_id: 'test_task',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('outside safe directory');
  });

  it('should reject disallowed file extensions', async () => {
    writeFileSync(join(safeRoot, 'malicious.exe'), 'binary data');

    const result = await tool.execute('read', { path: 'malicious.exe' }, {
      user_id: 1,
      task_id: 'test_task',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not allowed');

    unlinkSync(join(safeRoot, 'malicious.exe'));
  });

  it('should read nested files', async () => {
    const result = await tool.execute('read', { path: 'subdir/nested.txt' }, {
      user_id: 1,
      task_id: 'test_task',
    });

    expect(result.success).toBe(true);
    expect(result.data?.content).toBe('Nested content');
  });
});
