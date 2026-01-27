import { z } from 'zod';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';
import { InputSanitizer } from '../../core/security/input-sanitizer.js';

export class WebSandboxTool extends BaseTool {
  private sanitizer: InputSanitizer;

  constructor(
    logger: Logger,
    private allowedDomains: string[],
    private timeoutMs: number,
    private maxResponseSizeMb: number
  ) {
    super(logger);
    this.sanitizer = new InputSanitizer(logger);
  }

  getName(): string {
    return 'web_sandbox';
  }

  getDescription(): string {
    return 'Fetch content from allowed web URLs';
  }

  getActions() {
    return {
      fetch: {
        description: 'Fetch content from a URL',
        parameters: z.object({
          url: z.string().url(),
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
      case 'fetch':
        return this.fetchUrl(params.url);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async fetchUrl(urlString: string): Promise<ToolExecutionResult> {
    const sanitizedUrl = this.sanitizer.sanitizeUrl(urlString);

    if (!sanitizedUrl) {
      return {
        success: false,
        error: 'Invalid URL format',
      };
    }

    const url = new URL(sanitizedUrl);

    if (this.sanitizer.isPrivateIp(url.hostname)) {
      return {
        success: false,
        error: 'Access to private IP addresses is forbidden',
      };
    }

    if (!this.sanitizer.validateDomain(url.hostname, this.allowedDomains)) {
      return {
        success: false,
        error: `Domain ${url.hostname} is not in allowlist`,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(sanitizedUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'DockBrain/0.1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentLength = response.headers.get('content-length');
      const maxBytes = this.maxResponseSizeMb * 1024 * 1024;

      if (contentLength && parseInt(contentLength) > maxBytes) {
        return {
          success: false,
          error: `Response size exceeds maximum of ${this.maxResponseSizeMb}MB`,
        };
      }

      const text = await response.text();

      if (text.length > maxBytes) {
        return {
          success: false,
          error: `Response size exceeds maximum of ${this.maxResponseSizeMb}MB`,
        };
      }

      return {
        success: true,
        data: {
          url: sanitizedUrl,
          status: response.status,
          content: text,
          content_length: text.length,
        },
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `Request timeout after ${this.timeoutMs}ms`,
        };
      }

      return {
        success: false,
        error: `Failed to fetch URL: ${error.message}`,
      };
    }
  }
}
