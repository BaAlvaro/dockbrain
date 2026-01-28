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

export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private models: string[];
  private baseUrl: string;
  private referer?: string;
  private title?: string;

  constructor(
    private logger: Logger,
    apiKey: string,
    models: string[],
    referer?: string,
    title?: string
  ) {
    this.apiKey = apiKey;
    this.models = models;
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.referer = referer;
    this.title = title;
  }

  getName(): string {
    return 'openrouter';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (const model of this.models) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            ...(this.referer ? { 'HTTP-Referer': this.referer } : {}),
            ...(this.title ? { 'X-Title': this.title } : {}),
          },
          body: JSON.stringify({
            model,
            messages: request.messages,
            temperature: request.temperature ?? 0.1,
            max_tokens: request.max_tokens ?? 1500,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          const err = new Error(`OpenRouter API error: ${response.status} - ${error}`);
          lastError = err;

          if (response.status === 401 || response.status === 403) {
            throw err;
          }

          this.logger.warn({ model, status: response.status }, 'OpenRouter model failed, trying next');
          continue;
        }

        const data = (await response.json()) as OpenAIChatResponse;
        const content = data.choices?.[0]?.message?.content ?? '';

        if (!content) {
          const err = new Error('OpenRouter response had empty content');
          lastError = err;
          this.logger.warn({ model }, 'OpenRouter empty response, trying next');
          continue;
        }

        return {
          content,
          usage: data.usage
            ? {
                prompt_tokens: data.usage.prompt_tokens,
                completion_tokens: data.usage.completion_tokens,
                total_tokens: data.usage.total_tokens,
              }
            : undefined,
        };
      } catch (error: any) {
        lastError = error;
        this.logger.warn({ model, error: error?.message }, 'OpenRouter model error, trying next');
      }
    }

    if (lastError) {
      this.logger.error({ error: lastError }, 'OpenRouter API call failed');
      throw lastError;
    }

    throw new Error('OpenRouter API call failed: no models available');
  }
}
