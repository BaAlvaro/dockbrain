import { describe, it, expect } from 'vitest';
import { SystemExecTool } from '../../../src/tools/system-exec/tool.js';
import { createLogger } from '../../../src/utils/logger.js';

describe('SystemExecTool', () => {
  it('runs allowed command', async () => {
    const logger = createLogger();
    const tool = new SystemExecTool(
      logger,
      ['echo'],
      [],
      ['status'],
      ['*'],
      ['status'],
      20000,
      15000,
      []
    );

    const result = await tool.execute(
      'run_command',
      { command: 'echo', args: ['hello'] },
      { user_id: 1, task_id: 't1' }
    );

    expect(result.success).toBe(true);
    expect(result.data?.stdout).toContain('hello');
  });
});
