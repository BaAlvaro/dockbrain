import type { Logger } from '../../utils/logger.js';
import type { LLMProvider } from '../agent/llm-provider.js';
import { AgentSession } from './agent-session.js';

export class SessionManager {
  private sessions: Map<string, AgentSession> = new Map();

  constructor(
    private logger: Logger,
    private llmProvider: LLMProvider,
    private temperature: number,
    private maxTokens: number
  ) {}

  createSession(userId: number, name: string): string {
    const sessionId = this.generateSessionId();
    const session = new AgentSession(
      sessionId,
      userId,
      name,
      this.llmProvider,
      this.temperature,
      this.maxTokens,
      this.logger
    );
    this.sessions.set(sessionId, session);
    this.logger.info({ sessionId, userId, name }, 'Session created');
    return sessionId;
  }

  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(userId: number): AgentSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    this.logger.info({ sessionId }, 'Session destroyed');
    return true;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
