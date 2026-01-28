import { promises as fs } from 'fs';
import path from 'path';
import type { Logger } from '../../utils/logger.js';
import type { MemoryEntry, UserMemory } from './types.js';

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
    const normalized = this.normalizeContent(memory.content);
    const extracted = this.extractStructuredMemory(memory.content);
    const now = Date.now();

    if (extracted?.profileUpdate) {
      userMemory.profile = {
        ...userMemory.profile,
        ...extracted.profileUpdate,
        preferences: {
          ...userMemory.profile.preferences,
          ...extracted.profileUpdate.preferences,
        },
      };
    }

    const existing = this.findExistingEntry(userMemory.memories, normalized, extracted?.key);
    if (existing) {
      existing.timestamp = now;
      existing.relevance = Math.max(existing.relevance, memory.relevance);
      if (extracted?.key) {
        existing.key = extracted.key;
        existing.value = extracted.value;
      }
      existing.content = memory.content;
      existing.normalized = normalized;
      await this.saveMemory(userId, userMemory);
      return existing;
    }

    const entry: MemoryEntry = {
      ...memory,
      id: this.generateId(),
      timestamp: now,
      normalized,
      ...(extracted?.key ? { key: extracted.key, value: extracted.value } : {}),
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
    const structuredMatch = this.searchStructuredMemory(memory, query);

    const scored = memory.memories
      .map((entry) => {
        const content = entry.content.toLowerCase();
        const hits = keywords.reduce((count, keyword) => count + (content.includes(keyword) ? 1 : 0), 0);
        const recencyBoost = Math.min(1, (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24 * 7));
        const score = hits * 1.5 + entry.relevance + (1 - recencyBoost);
        return { entry, score, hits };
      })
      .filter((item) => item.hits > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.entry);

    const deduped = this.dedupeEntries(scored);
    if (structuredMatch) {
      return [structuredMatch, ...deduped.filter((entry) => entry.key !== structuredMatch.key)];
    }

    return deduped;
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

  private normalizeContent(content: string): string {
    return content
      .trim()
      .toLowerCase()
      .replace(/[“”"']/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s:.-]/gu, '');
  }

  private dedupeEntries(entries: MemoryEntry[]): MemoryEntry[] {
    const seen = new Set<string>();
    return entries.filter((entry) => {
      const key = entry.key ?? entry.normalized ?? entry.content;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private findExistingEntry(entries: MemoryEntry[], normalized: string, key?: string): MemoryEntry | undefined {
    if (key) {
      const byKey = entries.find((entry) => entry.key === key);
      if (byKey) return byKey;
    }
    return entries.find((entry) => entry.normalized === normalized);
  }

  private extractStructuredMemory(content: string): {
    key?: string;
    value?: string;
    profileUpdate?: Partial<UserMemory['profile']>;
  } | null {
    const projectMatch =
      content.match(/mi proyecto (se llama|es)\s+(.+)/i) ||
      content.match(/nombre del proyecto es\s+(.+)/i) ||
      content.match(/the project name is\s+(.+)/i) ||
      content.match(/my project is\s+(.+)/i);
    if (projectMatch) {
      const value = projectMatch[2] ?? projectMatch[1];
      const cleanValue = value?.trim().replace(/[.。！!]+$/, '');
      if (cleanValue) {
        return {
          key: 'project_name',
          value: cleanValue,
          profileUpdate: { preferences: { project_name: cleanValue } },
        };
      }
    }

    const nameMatch =
      content.match(/mi nombre es\s+(.+)/i) ||
      content.match(/me llamo\s+(.+)/i) ||
      content.match(/my name is\s+(.+)/i);
    if (nameMatch) {
      const value = nameMatch[1]?.trim().replace(/[.。！!]+$/, '');
      if (value) {
        return {
          key: 'user_name',
          value,
          profileUpdate: { name: value },
        };
      }
    }

    return null;
  }

  private searchStructuredMemory(memory: UserMemory, query: string): MemoryEntry | null {
    const normalizedQuery = query.toLowerCase();
    const asksProjectName =
      (normalizedQuery.includes('proyecto') && normalizedQuery.includes('nombre')) ||
      normalizedQuery.includes('project name') ||
      normalizedQuery.includes('nombre del proyecto');
    if (asksProjectName) {
      const projectName = memory.profile.preferences?.project_name as string | undefined;
      if (projectName) {
        return {
          id: 'mem_project_name',
          timestamp: Date.now(),
          category: 'fact',
          content: `El proyecto se llama ${projectName}`,
          relevance: 1,
          key: 'project_name',
          value: projectName,
          normalized: this.normalizeContent(projectName),
        };
      }
    }

    const asksUserName =
      normalizedQuery.includes('mi nombre') ||
      normalizedQuery.includes('me llamo') ||
      normalizedQuery.includes('my name');
    if (asksUserName && memory.profile.name) {
      return {
        id: 'mem_user_name',
        timestamp: Date.now(),
        category: 'fact',
        content: `Tu nombre es ${memory.profile.name}`,
        relevance: 1,
        key: 'user_name',
        value: memory.profile.name,
        normalized: this.normalizeContent(memory.profile.name),
      };
    }

    return null;
  }
}
