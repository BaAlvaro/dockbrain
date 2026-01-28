import type { LLMMessage, LLMProvider } from '../agent/llm-provider.js';
import type { Logger } from '../../utils/logger.js';

const MAX_HISTORY = 40;

export class AgentSession {
  public readonly createdAt: number;
  public messages: LLMMessage[] = [];

  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly name: string,
    private llmProvider: LLMProvider,
    private temperature: number,
    private maxTokens: number,
    private logger: Logger,
    systemPrompt?: string,
    createdAt?: number,
    initialMessages?: LLMMessage[]
  ) {
    this.createdAt = createdAt ?? Date.now();
    if (initialMessages && initialMessages.length > 0) {
      this.messages = initialMessages;
    } else {
      this.messages.push({
        role: 'system',
        content:
          systemPrompt ||
          `You are DockBrain agent session "${name}". Be concise and helpful.`,
      });
    }
  }

  async send(message: string): Promise<string> {
    this.messages.push({ role: 'user', content: message });
    this.messages = this.trimHistory(this.messages);

    const response = await this.llmProvider.complete({
      messages: this.messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    });

    this.messages.push({ role: 'assistant', content: response.content });
    this.messages = this.trimHistory(this.messages);

    this.logger.info({ sessionId: this.id }, 'Session response generated');
    return response.content;
  }

  private trimHistory(messages: LLMMessage[]): LLMMessage[] {
    if (messages.length <= MAX_HISTORY) {
      return messages;
    }
    const system = messages.find((m) => m.role === 'system');
    const recent = messages.slice(-MAX_HISTORY);
    return system ? [system, ...recent.filter((m) => m !== system)] : recent;
  }
}
