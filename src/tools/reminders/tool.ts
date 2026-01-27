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
          message: z.string().min(1).max(500),
          remind_at: z.string().datetime(), // ISO 8601
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
    const count = this.reminderRepo.countByUserId(context.user_id);

    if (count >= this.maxRemindersPerUser) {
      return {
        success: false,
        error: `Maximum of ${this.maxRemindersPerUser} reminders per user reached`,
      };
    }

    const remindAt = new Date(params.remind_at).getTime();

    if (remindAt <= Date.now()) {
      return {
        success: false,
        error: 'Reminder time must be in the future',
      };
    }

    const reminder = this.reminderRepo.create({
      id: generateReminderId(),
      user_id: context.user_id,
      message: params.message,
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
