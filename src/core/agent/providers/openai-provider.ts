import type { LLMProvider, LLMRequest, LLMResponse } from '../llm-provider.js';
import type { Logger } from '../../../utils/logger.js';

type OpenAIChatResponse = {
  choices: Array<{ message: { content: string } }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(
    private logger: Logger,
    apiKey: string,
    model: string = 'gpt-4-turbo-preview'
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  getName(): string {
    return 'openai';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          temperature: request.temperature || 0.1,
          max_tokens: request.max_tokens || 1500,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as OpenAIChatResponse;

      return {
        content: data.choices[0].message.content,
        usage: data.usage
          ? {
              prompt_tokens: data.usage.prompt_tokens,
              completion_tokens: data.usage.completion_tokens,
              total_tokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      this.logger.error({ error }, 'OpenAI API call failed');
      throw error;
    }
  }
}
