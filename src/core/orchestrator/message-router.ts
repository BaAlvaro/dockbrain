import type { Logger } from '../../utils/logger.js';
import { SessionManager } from './session-manager.js';

export class MessageRouter {
  constructor(private logger: Logger, private sessionManager: SessionManager) {}

  async routeToSession(userId: number, sessionId: string, message: string): Promise<string> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found');
    }

    const reply = await session.send(message);
    await this.sessionManager.recordMessage(sessionId);
    this.logger.debug({ sessionId, userId }, 'Routed message to session');
    return reply;
  }
}
