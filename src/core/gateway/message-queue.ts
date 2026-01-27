import type { IncomingMessage } from '../../types/message.js';
import type { Logger } from '../../utils/logger.js';
import EventEmitter from 'events';

export class MessageQueue extends EventEmitter {
  private queue: IncomingMessage[] = [];
  private processing = false;
  private maxQueueSize: number;

  constructor(
    private logger: Logger,
    maxQueueSize: number = 100
  ) {
    super();
    this.maxQueueSize = maxQueueSize;
  }

  enqueue(message: IncomingMessage): boolean {
    if (this.queue.length >= this.maxQueueSize) {
      this.logger.warn({ queueSize: this.queue.length }, 'Message queue is full');
      return false;
    }

    this.queue.push(message);
    this.logger.debug({ messageId: message.message_id, queueSize: this.queue.length }, 'Message enqueued');

    if (!this.processing) {
      this.processNext();
    }

    return true;
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const message = this.queue.shift();

    if (!message) {
      this.processing = false;
      return;
    }

    try {
      this.emit('message', message);
    } catch (error) {
      this.logger.error({ error, messageId: message.message_id }, 'Error processing message');
    }

    setTimeout(() => this.processNext(), 100);
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    this.processing = false;
  }
}
