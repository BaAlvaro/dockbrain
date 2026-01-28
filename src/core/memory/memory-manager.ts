import type { Logger } from '../../utils/logger.js';
import { UserMemoryManager } from './user-memory.js';
import type { MemoryCategory, MemoryEntry, UserMemory } from './types.js';

export interface MemoryConfig {
  include_in_prompt: boolean;
  max_entries: number;
  auto_append_user: boolean;
  auto_append_assistant: boolean;
}

export class MemoryManager {
  constructor(
    private logger: Logger,
    private userMemory: UserMemoryManager,
    private config: MemoryConfig
  ) {}

  async getUserMemory(userId: number): Promise<UserMemory> {
    return this.userMemory.getUserMemory(userId);
  }

  async addMemory(userId: number, content: string, category: MemoryCategory, relevance = 0.5): Promise<MemoryEntry> {
    return this.userMemory.addMemory(userId, { content, category, relevance });
  }

  async search(userId: number, query: string): Promise<MemoryEntry[]> {
    return this.userMemory.searchMemories(userId, query);
  }

  async recordInteraction(userId: number, userMessage: string, assistantMessage: string): Promise<void> {
    if (this.config.auto_append_user && !this.shouldSkipUserAutoAppend(userMessage)) {
      await this.addMemory(userId, userMessage, 'context', 0.6);
    }

    if (this.config.auto_append_assistant && !this.shouldSkipAssistantAutoAppend(assistantMessage)) {
      await this.addMemory(userId, assistantMessage, 'context', 0.4);
    }

    this.logger.debug({ userId }, 'Recorded interaction in memory');
  }

  getConfig(): MemoryConfig {
    return this.config;
  }

  private shouldSkipUserAutoAppend(message: string): boolean {
    const text = message.trim().toLowerCase();
    return (
      text.startsWith('recuerda') ||
      text.startsWith('remember') ||
      text.includes('¿cómo se llama') ||
      text.includes('que recuerdas') ||
      text.includes('qué recuerdas') ||
      text.includes('que me dijiste') ||
      text.includes('qué me dijiste')
    );
  }

  private shouldSkipAssistantAutoAppend(message: string): boolean {
    const text = message.trim().toLowerCase();
    return (
      text.startsWith('esto es lo que recuerdo') ||
      text.startsWith('no encontré recuerdos') ||
      text.startsWith('listo. lo recordaré') ||
      text.startsWith('tu proyecto se llama') ||
      text.startsWith('tu nombre es')
    );
  }
}
