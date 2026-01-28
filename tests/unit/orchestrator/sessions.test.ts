import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { SessionManager } from '../../../src/core/orchestrator/session-manager.js';
import type { LLMProvider, LLMRequest, LLMResponse } from '../../../src/core/agent/llm-provider.js';
import { createLogger } from '../../../src/utils/logger.js';

class DummyProvider implements LLMProvider {
  getName(): string {
    return 'dummy';
  }

  async complete(_request: LLMRequest): Promise<LLMResponse> {
    return { content: 'ok' };
  }
}

describe('SessionManager', () => {
  const logger = createLogger();
  let dataDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'dockbrain-sessions-'));
    manager = new SessionManager(logger, new DummyProvider(), 0.2, 200, dataDir);
  });

  it('persists sessions to disk', async () => {
    const sessionId = await manager.createSession(1, 'research');
    const session = await manager.getSession(sessionId);
    expect(session).toBeTruthy();
    if (session) {
      await session.send('hola');
      await manager.recordMessage(sessionId);
    }

    const newManager = new SessionManager(logger, new DummyProvider(), 0.2, 200, dataDir);
    const loadedSessions = await newManager.listSessions(1);
    expect(loadedSessions.length).toBe(1);
    expect(loadedSessions[0].name).toBe('research');
  });
});
