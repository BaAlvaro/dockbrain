import type { IncomingMessage } from '../../types/message.js';
import type { Logger } from '../../utils/logger.js';
import type { TaskRepository } from '../../persistence/repositories/task-repository.js';
import type { UserRepository } from '../../persistence/repositories/user-repository.js';
import type { TaskEngine } from '../orchestrator/task-engine.js';
import type { RateLimiter } from './rate-limiter.js';
import { MessageQueue } from './message-queue.js';
import { generateTaskId } from '../../utils/crypto.js';
import Database from 'better-sqlite3';

export class Gateway {
  private messageQueue: MessageQueue;
  private processedMessages = new Map<string, boolean>();

  constructor(
    private db: Database.Database,
    private taskRepo: TaskRepository,
    private userRepo: UserRepository,
    private taskEngine: TaskEngine,
    private rateLimiter: RateLimiter,
    private logger: Logger,
    private onTaskComplete: (userId: number, taskId: string, result: string) => Promise<void>
  ) {
    this.messageQueue = new MessageQueue(logger);

    this.messageQueue.on('message', async (message: IncomingMessage) => {
      await this.handleMessage(message);
    });

    setInterval(() => this.cleanupDedupCache(), 300000);
  }

  async processMessage(message: IncomingMessage): Promise<void> {
    const dedupKey = `${message.chat_id}:${message.message_id}`;

    if (this.processedMessages.has(dedupKey)) {
      this.logger.debug({ dedupKey }, 'Duplicate message ignored');
      return;
    }

    if (!this.isDedupedInDb(message)) {
      this.logger.debug({ dedupKey }, 'Message already processed (from DB)');
      return;
    }

    const user = this.userRepo.findByTelegramChatId(message.chat_id);

    if (!user) {
      this.logger.warn({ chatId: message.chat_id }, 'Message from unpaired user');
      return;
    }

    if (!user.is_active) {
      this.logger.warn({ userId: user.id }, 'Message from inactive user');
      return;
    }

    const rateLimitKey = `user:${user.id}`;
    if (!this.rateLimiter.check(rateLimitKey, user.rate_limit_per_minute)) {
      this.logger.warn({ userId: user.id }, 'Rate limit exceeded');
      return;
    }

    this.messageQueue.enqueue(message);
    this.processedMessages.set(dedupKey, true);
  }

  private async handleMessage(message: IncomingMessage): Promise<void> {
    const user = this.userRepo.findByTelegramChatId(message.chat_id);

    if (!user) {
      return;
    }

    const taskId = generateTaskId();

    try {
      let task = this.taskRepo.create({
        id: taskId,
        user_id: user.id,
        telegram_message_id: message.message_id,
        input_message: message.text,
      });

      this.storeDedupEntry(message, taskId);

      this.logger.info({ taskId, userId: user.id }, 'Task created, starting processing');

      task = await this.taskEngine.processTask(task);

      if (task.status === 'done' && task.result) {
        await this.onTaskComplete(user.id, task.id, task.result);
      } else if (task.status === 'failed' && task.error) {
        await this.onTaskComplete(user.id, task.id, `Error: ${task.error}`);
      }
    } catch (error: any) {
      this.logger.error({ error, taskId }, 'Failed to handle message');
      await this.onTaskComplete(user.id, taskId, `System error: ${error.message}`);
    }
  }

  private isDedupedInDb(message: IncomingMessage): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM message_dedup
      WHERE telegram_chat_id = ? AND telegram_message_id = ?
    `);

    const result = stmt.get(message.chat_id, message.message_id) as any;
    return result.count === 0;
  }

  private storeDedupEntry(message: IncomingMessage, taskId: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO message_dedup (telegram_message_id, telegram_chat_id, received_at, task_id)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(message.message_id, message.chat_id, message.timestamp, taskId);
  }

  private cleanupDedupCache(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;

    let cleaned = 0;
    for (const [key, value] of this.processedMessages.entries()) {
      if (value) {
        this.processedMessages.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug({ cleaned }, 'Cleaned dedup cache');
    }

    const stmt = this.db.prepare(`
      DELETE FROM message_dedup WHERE received_at < ?
    `);
    stmt.run(fiveMinutesAgo);
  }
}
