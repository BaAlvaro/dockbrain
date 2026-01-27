import type { LLMProvider, LLMRequest, LLMResponse } from '../llm-provider.js';
import type { Logger } from '../../../utils/logger.js';

export class MockLLMProvider implements LLMProvider {
  constructor(private logger: Logger) {}

  getName(): string {
    return 'mock';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    this.logger.debug({ messages: request.messages }, 'Mock LLM call');

    const userMessage = request.messages.find((m) => m.role === 'user')?.content || '';

    let mockResponse = '';

    if (userMessage.toLowerCase().includes('recordatorio') || userMessage.toLowerCase().includes('reminder')) {
      mockResponse = JSON.stringify({
        steps: [
          {
            id: 'step_1',
            tool: 'reminders',
            action: 'create',
            params: {
              message: 'Test reminder',
              remind_at: new Date(Date.now() + 3600000).toISOString(),
            },
            requires_confirmation: false,
            verification: {
              type: 'reminder_created',
              params: {},
            },
          },
        ],
        estimated_tools: ['reminders'],
      });
    } else if (userMessage.toLowerCase().includes('list') || userMessage.toLowerCase().includes('listar')) {
      mockResponse = JSON.stringify({
        steps: [
          {
            id: 'step_1',
            tool: 'reminders',
            action: 'list',
            params: {},
            requires_confirmation: false,
            verification: {
              type: 'data_retrieved',
              params: {},
            },
          },
        ],
        estimated_tools: ['reminders'],
      });
    } else {
      mockResponse = JSON.stringify({
        steps: [
          {
            id: 'step_1',
            tool: 'system_info',
            action: 'get',
            params: {},
            requires_confirmation: false,
            verification: {
              type: 'data_retrieved',
              params: {},
            },
          },
        ],
        estimated_tools: ['system_info'],
      });
    }

    return {
      content: mockResponse,
      usage: {
        prompt_tokens: 50,
        completion_tokens: 100,
        total_tokens: 150,
      },
    };
  }
}
