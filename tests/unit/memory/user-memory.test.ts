import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { UserMemoryManager } from '../../../src/core/memory/user-memory.js';
import { createLogger } from '../../../src/utils/logger.js';

describe('UserMemoryManager', () => {
  const logger = createLogger();
  let dataDir: string;
  let manager: UserMemoryManager;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'dockbrain-memory-'));
    manager = new UserMemoryManager(logger, dataDir);
  });

  it('adds and searches memory', async () => {
    await manager.addMemory(1, {
      category: 'fact',
      content: 'El proyecto se llama DockBrain',
      relevance: 0.8,
    });

    const results = await manager.searchMemories(1, 'DockBrain');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('DockBrain');
  });
});
