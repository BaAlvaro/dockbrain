import { z } from 'zod';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';
import type { ReminderRepository } from '../../persistence/repositories/reminder-repository.js';
import { generateReminderId } from '../../utils/crypto.js';

export class RemindersTool extends BaseTool {
  constructor(
    logger: Logger,
    private reminderRepo: ReminderRepository,
    private maxRemindersPerUser: number
  ) {
    super(logger);
  }

  getName(): string {
    return 'reminders';
  }

  getDescription(): string {
    return 'Create, list and delete reminders';
  }

  getActions() {
    return {
      create: {
        description: 'Create a new reminder',
        parameters: z.object({
          message: z.string().min(1).max(500).optional(),
          remind_at: z.string().optional(), // ISO 8601
        }),
      },
      list: {
        description: 'List all active reminders',
        parameters: z.object({}),
      },
      delete: {
        description: 'Delete a reminder by ID',
        parameters: z.object({
          reminder_id: z.string(),
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
      case 'create':
        return this.createReminder(params, context);
      case 'list':
        return this.listReminders(context);
      case 'delete':
        return this.deleteReminder(params, context);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private createReminder(
    params: { message: string; remind_at: string },
    context: ToolExecutionContext
  ): ToolExecutionResult {
    const normalized = this.normalizeReminderParams(params, context.user_message);
    if (!normalized.message || !normalized.remind_at) {
      return {
        success: false,
        error:
          'Missing reminder details. Please include a message and time, e.g. "Recuérdame mañana a las 10am comprar leche".',
      };
    }

    const count = this.reminderRepo.countByUserId(context.user_id);

    if (count >= this.maxRemindersPerUser) {
      return {
        success: false,
        error: `Maximum of ${this.maxRemindersPerUser} reminders per user reached`,
      };
    }

    let remindAt = new Date(normalized.remind_at).getTime();
    if (!Number.isFinite(remindAt) || remindAt <= Date.now()) {
      const fallback = this.inferFromText(context.user_message || '');
      if (fallback.remind_at) {
        const fallbackTime = new Date(fallback.remind_at).getTime();
        if (Number.isFinite(fallbackTime)) {
          remindAt = fallbackTime;
        }
      }
    }

    if (Number.isFinite(remindAt) && remindAt <= Date.now()) {
      remindAt += 24 * 60 * 60 * 1000;
    }

    if (!Number.isFinite(remindAt) || remindAt <= Date.now()) {
      return {
        success: false,
        error: 'Reminder time must be in the future',
      };
    }

    const reminder = this.reminderRepo.create({
      id: generateReminderId(),
      user_id: context.user_id,
      message: normalized.message,
      remind_at: remindAt,
      created_by_task_id: context.task_id,
    });

    return {
      success: true,
      data: {
        reminder_id: reminder.id,
        message: reminder.message,
        remind_at: new Date(reminder.remind_at).toISOString(),
      },
    };
  }

  private normalizeReminderParams(
    params: { message?: string; remind_at?: string },
    userMessage?: string
  ): { message?: string; remind_at?: string } {
    const message = params.message?.trim();
    const remindAt = params.remind_at?.trim();

    if (message && remindAt) {
      return { message, remind_at: remindAt };
    }

    if (!userMessage) {
      return { message, remind_at: remindAt };
    }

    const inferred = this.inferFromText(userMessage);
    return {
      message: message || inferred.message,
      remind_at: remindAt || inferred.remind_at,
    };
  }

  private inferFromText(text: string): { message?: string; remind_at?: string } {
    const lower = text.toLowerCase();
    const isTomorrow = lower.includes('mañana') || lower.includes('tomorrow');
    if (!isTomorrow) {
      const inMinutes = text.match(/(?:en|in)\s+(\d{1,3})\s*(min|mins|minutos|minutes)/i);
      if (inMinutes) {
        const minutes = parseInt(inMinutes[1], 10);
        const now = new Date();
        const target = new Date(now.getTime() + minutes * 60 * 1000);
        const msg = text
          .replace(inMinutes[0], '')
          .replace(/["“”]/g, '')
          .trim() || text.trim();
        return { message: msg, remind_at: target.toISOString() };
      }

      return { message: text.trim() };
    }

    const timeRegex =
      /(?:mañana|tomorrow)(?:\s+a\s+las|\s+at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = text.match(timeRegex);
    if (!match) {
      return { message: text.trim() };
    }

    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3]?.toLowerCase();

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    const now = new Date();
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      hour,
      minute,
      0,
      0
    );

    return {
      message: text.trim(),
      remind_at: target.toISOString(),
    };
  }

  private listReminders(context: ToolExecutionContext): ToolExecutionResult {
    const reminders = this.reminderRepo.findByUserId(context.user_id);

    return {
      success: true,
      data: {
        reminders: reminders.map((r) => ({
          id: r.id,
          message: r.message,
          remind_at: new Date(r.remind_at).toISOString(),
        })),
        count: reminders.length,
      },
    };
  }

  private deleteReminder(
    params: { reminder_id: string },
    context: ToolExecutionContext
  ): ToolExecutionResult {
    const reminder = this.reminderRepo.findById(params.reminder_id);

    if (!reminder) {
      return {
        success: false,
        error: 'Reminder not found',
      };
    }

    if (reminder.user_id !== context.user_id) {
      return {
        success: false,
        error: 'Permission denied: reminder belongs to another user',
      };
    }

    const deleted = this.reminderRepo.delete(params.reminder_id);

    if (!deleted) {
      return {
        success: false,
        error: 'Failed to delete reminder',
      };
    }

    return {
      success: true,
      data: {
        reminder_id: params.reminder_id,
        deleted: true,
      },
    };
  }
}
