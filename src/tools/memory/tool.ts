import { z } from 'zod';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';
import { MemoryManager } from '../../core/memory/memory-manager.js';

export class MemoryTool extends BaseTool {
  constructor(logger: Logger, private memoryManager: MemoryManager) {
    super(logger);
  }

  getName(): string {
    return 'memory';
  }

  getDescription(): string {
    return 'Store and search user memories';
  }

  getActions() {
    return {
      add: {
        description: 'Add a memory entry',
        parameters: z.object({
          content: z.string().min(1),
          category: z.enum(['fact', 'preference', 'context']),
          relevance: z.coerce.number().min(0).max(1).optional().default(0.5),
        }),
      },
      search: {
        description: 'Search memories by keyword',
        parameters: z.object({
          query: z.string().optional().default(''),
        }),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    switch (action) {
      case 'add':
        return this.addMemory(context.user_id, params.content, params.category, params.relevance);
      case 'search':
        return this.searchMemory(context.user_id, params.query, context.user_message);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async addMemory(
    userId: number,
    content: string,
    category: 'fact' | 'preference' | 'context',
    relevance: number
  ): Promise<ToolExecutionResult> {
    const entry = await this.memoryManager.addMemory(userId, content, category, relevance);

    return {
      success: true,
      data: {
        id: entry.id,
        timestamp: entry.timestamp,
        category: entry.category,
        content: entry.content,
      },
    };
  }

  private async searchMemory(
    userId: number,
    query?: string,
    fallbackQuery?: string
  ): Promise<ToolExecutionResult> {
    const effectiveQuery = query && query.trim().length > 0 ? query : fallbackQuery || '';
    if (!effectiveQuery) {
      return { success: false, error: 'Query is required' };
    }
    const results = await this.memoryManager.search(userId, effectiveQuery);
    return { success: true, data: { results } };
  }
}
