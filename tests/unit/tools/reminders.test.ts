import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { RemindersTool } from '../../../src/tools/reminders/tool.js';
import { ReminderRepository } from '../../../src/persistence/repositories/reminder-repository.js';
import { createLogger } from '../../../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Reminders Tool', () => {
  let db: Database.Database;
  let reminderRepo: ReminderRepository;
  let tool: RemindersTool;
  let logger: any;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const migrationPath = join(__dirname, '../../../src/persistence/migrations/001_initial_schema.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    db.exec(migration);

    reminderRepo = new ReminderRepository(db);
    logger = createLogger();
    tool = new RemindersTool(logger, reminderRepo, 50);
  });

  it('should create a reminder', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const result = await tool.execute(
      'create',
      {
        message: 'Test reminder',
        remind_at: futureDate,
      },
      {
        user_id: 1,
        task_id: 'test_task',
      }
    );

    expect(result.success).toBe(true);
    expect(result.data?.reminder_id).toBeDefined();
    expect(result.data?.message).toBe('Test reminder');
  });

  it('should reject past reminder dates', async () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();

    const result = await tool.execute(
      'create',
      {
        message: 'Past reminder',
        remind_at: pastDate,
      },
      {
        user_id: 1,
        task_id: 'test_task',
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('must be in the future');
  });

  it('should list reminders', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    await tool.execute(
      'create',
      {
        message: 'Reminder 1',
        remind_at: futureDate,
      },
      {
        user_id: 1,
        task_id: 'test_task',
      }
    );

    const result = await tool.execute('list', {}, {
      user_id: 1,
      task_id: 'test_task',
    });

    expect(result.success).toBe(true);
    expect(result.data?.reminders).toBeDefined();
    expect(result.data?.reminders.length).toBe(1);
    expect(result.data?.reminders[0].message).toBe('Reminder 1');
  });

  it('should delete a reminder', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const createResult = await tool.execute(
      'create',
      {
        message: 'To be deleted',
        remind_at: futureDate,
      },
      {
        user_id: 1,
        task_id: 'test_task',
      }
    );

    const reminderId = createResult.data?.reminder_id;

    const deleteResult = await tool.execute(
      'delete',
      { reminder_id: reminderId },
      {
        user_id: 1,
        task_id: 'test_task',
      }
    );

    expect(deleteResult.success).toBe(true);
    expect(deleteResult.data?.deleted).toBe(true);
  });

  it('should not delete reminder from another user', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const createResult = await tool.execute(
      'create',
      {
        message: 'User 1 reminder',
        remind_at: futureDate,
      },
      {
        user_id: 1,
        task_id: 'test_task',
      }
    );

    const reminderId = createResult.data?.reminder_id;

    const deleteResult = await tool.execute(
      'delete',
      { reminder_id: reminderId },
      {
        user_id: 2,
        task_id: 'test_task',
      }
    );

    expect(deleteResult.success).toBe(false);
    expect(deleteResult.error).toContain('belongs to another user');
  });
});
