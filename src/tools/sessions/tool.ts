import { z } from 'zod';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';
import { SessionManager } from '../../core/orchestrator/session-manager.js';
import { MessageRouter } from '../../core/orchestrator/message-router.js';

export class SessionsTool extends BaseTool {
  constructor(
    logger: Logger,
    private sessionManager: SessionManager,
    private messageRouter: MessageRouter
  ) {
    super(logger);
  }

  getName(): string {
    return 'sessions';
  }

  getDescription(): string {
    return 'Create and manage lightweight agent sessions';
  }

  getActions() {
    return {
      spawn: {
        description: 'Create a new agent session',
        parameters: z.object({
          name: z.string().min(1).max(100),
        }),
      },
      list: {
        description: 'List active sessions for the user',
        parameters: z.object({}),
      },
      send: {
        description: 'Send a message to a session',
        parameters: z.object({
          session_id: z.string().min(1),
          message: z.string().min(1),
        }),
      },
      destroy: {
        description: 'Destroy a session',
        parameters: z.object({
          session_id: z.string().min(1),
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
      case 'spawn':
        return this.spawnSession(context.user_id, params.name);
      case 'list':
        return this.listSessions(context.user_id);
      case 'send':
        return this.sendToSession(context.user_id, params.session_id, params.message);
      case 'destroy':
        return this.destroySession(context.user_id, params.session_id);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async spawnSession(userId: number, name: string): Promise<ToolExecutionResult> {
    const sessionId = await this.sessionManager.createSession(userId, name);
    return { success: true, data: { session_id: sessionId, name } };
  }

  private async listSessions(userId: number): Promise<ToolExecutionResult> {
    const sessions = (await this.sessionManager.listSessions(userId)).map((session) => ({
      session_id: session.id,
      name: session.name,
      created_at: session.createdAt,
      message_count: session.messages.length,
    }));
    return { success: true, data: { sessions } };
  }

  private async sendToSession(
    userId: number,
    sessionId: string,
    message: string
  ): Promise<ToolExecutionResult> {
    try {
      const reply = await this.messageRouter.routeToSession(userId, sessionId, message);
      return { success: true, data: { session_id: sessionId, reply } };
    } catch (error: any) {
      return { success: false, error: error.message || 'Session not found' };
    }
  }

  private async destroySession(userId: number, sessionId: string): Promise<ToolExecutionResult> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session || session.userId !== userId) {
      return { success: false, error: 'Session not found' };
    }

    await this.sessionManager.destroySession(sessionId);
    return { success: true, data: { session_id: sessionId } };
  }
}
