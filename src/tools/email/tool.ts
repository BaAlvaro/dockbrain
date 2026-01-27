import { z } from 'zod';
import nodemailer from 'nodemailer';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';

export class EmailTool extends BaseTool {
  private transporter: nodemailer.Transporter | null = null;

  constructor(logger: Logger) {
    super(logger);
  }

  getName(): string {
    return 'email';
  }

  getDescription(): string {
    return 'Send emails via SMTP';
  }

  getActions() {
    return {
      send: {
        description: 'Send an email',
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

  private buildTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    if (!host || !user || !pass || !from) {
      throw new Error(
        'SMTP is not configured. Please set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM.'
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  private async sendEmail(params: { to: string; subject: string; body: string }): Promise<ToolExecutionResult> {
    try {
      const transporter = this.buildTransporter();
      const from = process.env.SMTP_FROM as string;

      const info = await transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        text: params.body,
      });

      return {
        success: true,
        data: {
          message_id: info.messageId,
          to: params.to,
          subject: params.subject,
        },
      };
    } catch (error: any) {
      this.logger.error({ error }, 'Email send failed');
      return { success: false, error: error.message || 'Email send failed' };
    }
  }
}
