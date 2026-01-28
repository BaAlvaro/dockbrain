import type { LLMProvider, LLMRequest, LLMResponse, LLMMessage } from '../llm-provider.js';
import type { Logger } from '../../../utils/logger.js';

type GeminiContentPart = {
  text?: string;
};

type GeminiContent = {
  role?: 'user' | 'model';
  parts: GeminiContentPart[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export class GeminiProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(
    private logger: Logger,
    apiKey: string,
    model: string = 'gemini-2.5-flash'
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  getName(): string {
    return 'gemini';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      const contents = this.buildContents(request.messages);

      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: request.temperature ?? 0.1,
              maxOutputTokens: request.max_tokens ?? 1500,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as GeminiResponse;
      const text = this.extractText(data);

      return {
        content: text,
        usage: data.usageMetadata
          ? {
              prompt_tokens: data.usageMetadata.promptTokenCount ?? 0,
              completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
              total_tokens: data.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
      };
    } catch (error: any) {
      this.logger.error({ error }, 'Gemini API call failed');
      throw error;
    }
  }

  private buildContents(messages: LLMMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');

    if (systemMessages.length > 0) {
      const systemText = systemMessages.map((m) => m.content).join('\n\n');
      contents.push({
        role: 'user',
        parts: [{ text: `[System]\n${systemText}` }],
      });
    }

    for (const message of nonSystem) {
      contents.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      });
    }

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: '' }],
      });
    }

    return contents;
  }

  private extractText(response: GeminiResponse): string {
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text).filter(Boolean).join('');
    return text || '';
  }
}
