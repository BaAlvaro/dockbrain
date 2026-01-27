import type { LLMProvider, LLMRequest, LLMResponse } from '../llm-provider.js';
import type { Logger } from '../../../utils/logger.js';

type OllamaGenerateResponse = {
  response: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
};

type OllamaTagsResponse = {
  models?: Array<{ name: string }>;
};

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(
    private logger: Logger,
    baseUrl: string = 'http://localhost:11434',
    model: string = 'llama3.2'
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  getName(): string {
    return 'ollama';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      const prompt = this.buildPrompt(request.messages);

      this.logger.debug({ model: this.model, promptLength: prompt.length }, 'Ollama request');

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: request.temperature || 0.1,
            num_predict: request.max_tokens || 1500,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as OllamaGenerateResponse;

      this.logger.debug(
        {
          responseLength: data.response?.length,
          totalDuration: data.total_duration,
        },
        'Ollama response received'
      );

      return {
        content: data.response,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error: any) {
      this.logger.error({ error, model: this.model }, 'Ollama API call failed');
      throw error;
    }
  }

  private buildPrompt(messages: any[]): string {
    let prompt = '';

    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `<|system|>\n${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `<|user|>\n${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `<|assistant|>\n${message.content}\n\n`;
      }
    }

    prompt += '<|assistant|>\n';

    return prompt;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as OllamaTagsResponse;
      const modelExists = data.models?.some((m) => m.name === this.model);

      if (!modelExists) {
        this.logger.warn(
          { model: this.model, availableModels: data.models?.map((m) => m.name) },
          'Configured model not found in Ollama'
        );
      }

      return true;
    } catch (error: any) {
      this.logger.error({ error }, 'Ollama health check failed');
      return false;
    }
  }
}
