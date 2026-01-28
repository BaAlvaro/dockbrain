import { promises as fs } from 'fs';
import path from 'path';
import type { Logger } from '../../utils/logger.js';
import type { LLMProvider, LLMMessage } from '../agent/llm-provider.js';
import { AgentSession } from './agent-session.js';

export class SessionManager {
  private sessions: Map<string, AgentSession> = new Map();
  private loaded = false;

  constructor(
    private logger: Logger,
    private llmProvider: LLMProvider,
    private temperature: number,
    private maxTokens: number,
    private dataDir: string
  ) {}

  async createSession(userId: number, name: string): Promise<string> {
    await this.ensureLoaded();
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
    await this.persist();
    this.logger.info({ sessionId, userId, name }, 'Session created');
    return sessionId;
  }

  async getSession(sessionId: string): Promise<AgentSession | undefined> {
    await this.ensureLoaded();
    return this.sessions.get(sessionId);
  }

  async listSessions(userId: number): Promise<AgentSession[]> {
    await this.ensureLoaded();
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  async destroySession(sessionId: string): Promise<boolean> {
    await this.ensureLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    await this.persist();
    this.logger.info({ sessionId }, 'Session destroyed');
    return true;
  }

  async recordMessage(sessionId: string): Promise<void> {
    if (!this.sessions.has(sessionId)) return;
    await this.persist();
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      const filePath = this.getSessionsPath();
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw) as Array<{
        id: string;
        userId: number;
        name: string;
        createdAt: number;
        messages: LLMMessage[];
      }>;

      for (const entry of data) {
        const session = new AgentSession(
          entry.id,
          entry.userId,
          entry.name,
          this.llmProvider,
          this.temperature,
          this.maxTokens,
          this.logger,
          undefined,
          entry.createdAt,
          entry.messages
        );
        this.sessions.set(entry.id, session);
      }
      this.logger.info({ count: this.sessions.size }, 'Sessions loaded from disk');
    } catch {
      // No sessions stored yet.
    }
  }

  private async persist(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const payload = Array.from(this.sessions.values()).map((session) => ({
        id: session.id,
        userId: session.userId,
        name: session.name,
        createdAt: session.createdAt,
        messages: session.messages,
      }));
      await fs.writeFile(this.getSessionsPath(), JSON.stringify(payload, null, 2), 'utf-8');
    } catch (error: any) {
      this.logger.warn({ error }, 'Failed to persist sessions');
    }
  }

  private getSessionsPath(): string {
    return path.join(this.dataDir, 'sessions.json');
  }
}
