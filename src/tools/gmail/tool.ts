import { z } from 'zod';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';
import { GmailService } from '../../core/integrations/gmail-service.js';

export class GmailTool extends BaseTool {
  private gmailService: GmailService;

  constructor(logger: Logger) {
    super(logger);
    this.gmailService = new GmailService();
  }

  getName(): string {
    return 'gmail';
  }

  getDescription(): string {
    return 'Send emails using Gmail API (OAuth)';
  }

  getActions() {
    return {
      send: {
        description: 'Send an email via Gmail',
        parameters: z.object({
          to: z.string().email(),
          subject: z.string().min(1).max(200),
          body: z.string().min(1).max(5000),
        }),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    switch (action) {
      case 'send':
        return this.sendEmail(params);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async sendEmail(params: { to: string; subject: string; body: string }): Promise<ToolExecutionResult> {
    try {
      const result = await this.gmailService.send({
        to: params.to,
        subject: params.subject,
        body: params.body,
      });

      return {
        success: true,
        data: {
          message_id: result.message_id,
          to: params.to,
          subject: params.subject,
        },
      };
    } catch (error: any) {
      this.logger.error({ error }, 'Gmail send failed');
      return { success: false, error: error.message || 'Gmail send failed' };
    }
  }
}
