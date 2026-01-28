import { z } from 'zod';
import { spawn } from 'child_process';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';

const MAX_OUTPUT_LENGTH = 12000;

type RunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export class CodexAuthTool extends BaseTool {
  constructor(
    logger: Logger,
    private cliPath: string = 'codex',
    private codexHome?: string,
    private timeoutMs: number = 60000
  ) {
    super(logger);
  }

  getName(): string {
    return 'codex_auth';
  }

  getDescription(): string {
    return 'Authenticate Codex CLI/IDE with ChatGPT account or API key';
  }

  getActions() {
    return {
      login_chatgpt: {
        description: 'Sign in with ChatGPT (browser or device auth)',
        parameters: z.object({
          device_auth: z.boolean().default(true),
        }),
      },
      login_api_key: {
        description: 'Sign in with OpenAI API key (read from env var)',
        parameters: z.object({
          api_key_env: z.string().default('OPENAI_API_KEY'),
        }),
      },
      status: {
        description: 'Check Codex login status',
        parameters: z.object({}),
      },
      logout: {
        description: 'Log out Codex (clears cached credentials)',
        parameters: z.object({}),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    switch (action) {
      case 'login_chatgpt':
        return this.loginChatGPT(params.device_auth);
      case 'login_api_key':
        return this.loginApiKey(params.api_key_env);
      case 'status':
        return this.status();
      case 'logout':
        return this.logout();
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async loginChatGPT(deviceAuth: boolean): Promise<ToolExecutionResult> {
    const args = ['login'];
    if (deviceAuth) {
      args.push('--device-auth');
    }

    const result = await this.runCodex(args);
    if (result.exitCode !== 0 || result.timedOut) {
      return this.failResult('Codex login failed', result);
    }

    return this.successResult('Codex login completed', result);
  }

  private async loginApiKey(apiKeyEnv: string): Promise<ToolExecutionResult> {
    const apiKey = process.env[apiKeyEnv];
    if (!apiKey) {
      return {
        success: false,
        error: `Missing API key in environment variable: ${apiKeyEnv}`,
      };
    }

    const result = await this.runCodex(['login', '--with-api-key'], apiKey + '\n');
    if (result.exitCode !== 0 || result.timedOut) {
      return this.failResult('Codex API key login failed', result);
    }

    return this.successResult('Codex API key login completed', result);
  }

  private async status(): Promise<ToolExecutionResult> {
    const result = await this.runCodex(['login', 'status']);

    return {
      success: true,
      data: {
        logged_in: result.exitCode === 0,
        stdout: this.truncate(result.stdout),
        stderr: this.truncate(result.stderr),
        exit_code: result.exitCode,
      },
    };
  }

  private async logout(): Promise<ToolExecutionResult> {
    const result = await this.runCodex(['logout']);
    if (result.exitCode !== 0 || result.timedOut) {
      return this.failResult('Codex logout failed', result);
    }

    return this.successResult('Codex logout completed', result);
  }

  private async runCodex(args: string[], input?: string): Promise<RunResult> {
    return new Promise((resolve) => {
      const env = { ...process.env };
      if (this.codexHome) {
        env.CODEX_HOME = this.codexHome;
      }

      const child = spawn(this.cliPath, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, this.timeoutMs);

      if (input) {
        child.stdin.write(input);
        child.stdin.end();
      }

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ exitCode: code, stdout, stderr, timedOut });
      });
    });
  }

  private successResult(message: string, result: RunResult): ToolExecutionResult {
    return {
      success: true,
      data: {
        message,
        stdout: this.truncate(result.stdout),
        stderr: this.truncate(result.stderr),
        exit_code: result.exitCode,
        timed_out: result.timedOut,
      },
    };
  }

  private failResult(message: string, result: RunResult): ToolExecutionResult {
    return {
      success: false,
      error: message,
      data: {
        stdout: this.truncate(result.stdout),
        stderr: this.truncate(result.stderr),
        exit_code: result.exitCode,
        timed_out: result.timedOut,
      },
    };
  }

  private truncate(value: string): string {
    if (!value) return '';
    if (value.length <= MAX_OUTPUT_LENGTH) return value.trim();
    return `${value.slice(0, MAX_OUTPUT_LENGTH).trim()}... [truncated]`;
  }
}
