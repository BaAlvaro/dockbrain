import type Database from 'better-sqlite3';

export interface Reminder {
  id: string;
  user_id: number;
  message: string;
  remind_at: number;
  created_by_task_id: string | null;
  is_completed: boolean;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CreateReminderInput {
  id: string;
  user_id: number;
  message: string;
  remind_at: number;
  created_by_task_id?: string;
}

export class ReminderRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateReminderInput): Reminder {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO reminders (
        id, user_id, message, remind_at, created_by_task_id,
        is_completed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `);

    stmt.run(
      input.id,
      input.user_id,
      input.message,
      input.remind_at,
      input.created_by_task_id || null,
      now,
      now
    );

    return this.findById(input.id)!;
  }

  findById(id: string): Reminder | null {
    const stmt = this.db.prepare('SELECT * FROM reminders WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByUserId(userId: number): Reminder[] {
    const stmt = this.db.prepare(`
      SELECT * FROM reminders WHERE user_id = ? AND is_completed = 0
      ORDER BY remind_at ASC
    `);
    const rows = stmt.all(userId) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  findDue(beforeTimestamp: number): Reminder[] {
    const stmt = this.db.prepare(`
      SELECT * FROM reminders
      WHERE remind_at <= ? AND is_completed = 0
      ORDER BY remind_at ASC
    `);
    const rows = stmt.all(beforeTimestamp) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  countByUserId(userId: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM reminders
      WHERE user_id = ? AND is_completed = 0
    `);
    const result = stmt.get(userId) as any;
    return result.count;
  }

  markCompleted(id: string): Reminder | null {
    const stmt = this.db.prepare(`
      UPDATE reminders
      SET is_completed = 1, completed_at = ?, updated_at = ?
      WHERE id = ?
    `);
    const now = Date.now();
    stmt.run(now, now, id);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM reminders WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  private mapRow(row: any): Reminder {
    return {
      id: row.id,
      user_id: row.user_id,
      message: row.message,
      remind_at: row.remind_at,
      created_by_task_id: row.created_by_task_id,
      is_completed: Boolean(row.is_completed),
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
