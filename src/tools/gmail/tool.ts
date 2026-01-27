import { z } from 'zod';
import { google } from 'googleapis';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';

export class GmailTool extends BaseTool {
  constructor(logger: Logger) {
    super(logger);
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

  private getAuth() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback';
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Gmail OAuth is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.'
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  private async sendEmail(params: { to: string; subject: string; body: string }): Promise<ToolExecutionResult> {
    try {
      const auth = this.getAuth();
      const gmail = google.gmail({ version: 'v1', auth });
      const from = process.env.GMAIL_FROM;

      const headers = [
        from ? `From: ${from}` : undefined,
        `To: ${params.to}`,
        `Subject: ${params.subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
      ].filter(Boolean);

      const message = `${headers.join('\r\n')}\r\n\r\n${params.body}`;
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      return {
        success: true,
        data: {
          message_id: result.data.id,
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
