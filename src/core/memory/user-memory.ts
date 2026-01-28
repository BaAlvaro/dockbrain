import { promises as fs } from 'fs';
import path from 'path';
import type { Logger } from '../../utils/logger.js';

export type MemoryCategory = 'fact' | 'preference' | 'context';

export interface MemoryEntry {
  id: string;
  timestamp: number;
  category: MemoryCategory;
  content: string;
  relevance: number;
}

export interface UserMemory {
  userId: number;
  profile: {
    name?: string;
    telegram?: string;
    preferences: Record<string, any>;
    context: string[];
  };
  memories: MemoryEntry[];
}

export class UserMemoryManager {
  constructor(private logger: Logger, private dataDir: string) {}

  async getUserMemory(userId: number): Promise<UserMemory> {
    const memoryPath = this.getMemoryPath(userId);
    try {
      const content = await fs.readFile(memoryPath, 'utf-8');
      return JSON.parse(content) as UserMemory;
    } catch {
      this.logger.info({ userId }, 'Creating new user memory');
      return this.createUserMemory(userId);
    }
  }

  async updateProfile(userId: number, updates: Partial<UserMemory['profile']>): Promise<void> {
    const memory = await this.getUserMemory(userId);
    memory.profile = { ...memory.profile, ...updates };
    await this.saveMemory(userId, memory);
  }

  async addMemory(
    userId: number,
    memory: Omit<MemoryEntry, 'id' | 'timestamp'>
  ): Promise<MemoryEntry> {
    const userMemory = await this.getUserMemory(userId);
    const entry: MemoryEntry = {
      ...memory,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    userMemory.memories.push(entry);
    if (userMemory.memories.length > 100) {
      userMemory.memories = userMemory.memories.slice(-100);
    }

    await this.saveMemory(userId, userMemory);
    return entry;
  }

  async searchMemories(userId: number, query: string): Promise<MemoryEntry[]> {
    const memory = await this.getUserMemory(userId);
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);

    return memory.memories
      .filter((m) => keywords.some((keyword) => m.content.toLowerCase().includes(keyword)))
      .sort((a, b) => b.relevance - a.relevance);
  }

  private async createUserMemory(userId: number): Promise<UserMemory> {
    const memory: UserMemory = {
      userId,
      profile: {
        preferences: {},
        context: [],
      },
      memories: [],
    };

    await this.saveMemory(userId, memory);
    return memory;
  }

  private async saveMemory(userId: number, memory: UserMemory): Promise<void> {
    const memoryPath = this.getMemoryPath(userId);
    await fs.mkdir(path.dirname(memoryPath), { recursive: true });
    await fs.writeFile(memoryPath, JSON.stringify(memory, null, 2), 'utf-8');
  }

  private getMemoryPath(userId: number): string {
    return path.join(this.dataDir, `users/${userId}/memory.json`);
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
