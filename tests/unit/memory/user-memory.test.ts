import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { UserMemoryManager } from '../../../src/core/memory/user-memory.js';
import { MemoryManager } from '../../../src/core/memory/memory-manager.js';
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

describe('MemoryManager', () => {
  const logger = createLogger();
  let dataDir: string;
  let manager: MemoryManager;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'dockbrain-memory2-'));
    manager = new MemoryManager(
      logger,
      new UserMemoryManager(logger, dataDir),
      {
        include_in_prompt: true,
        max_entries: 10,
        auto_append_user: true,
        auto_append_assistant: true,
      }
    );
  });

  it('records interactions', async () => {
    await manager.recordInteraction(1, 'hola', 'respuesta');
    const results = await manager.search(1, 'respuesta');
    expect(results.length).toBeGreaterThan(0);
  });

  it('searches with relevance ordering', async () => {
    await manager.addMemory(1, 'prefiere azul', 'preference', 0.9);
    await manager.addMemory(1, 'le gusta rojo', 'preference', 0.2);
    const results = await manager.search(1, 'prefiere');
    expect(results[0].content).toContain('prefiere');
  });
});
