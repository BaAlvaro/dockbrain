import type Database from 'better-sqlite3';

export type TaskStatus = 'queued' | 'planning' | 'executing' | 'verifying' | 'done' | 'failed';

export interface Task {
  id: string;
  user_id: number;
  telegram_message_id: number;
  status: TaskStatus;
  input_message: string;
  plan: any | null;
  execution_log: any | null;
  result: string | null;
  error: string | null;
  retry_count: number;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CreateTaskInput {
  id: string;
  user_id: number;
  telegram_message_id: number;
  input_message: string;
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  plan?: any;
  execution_log?: any;
  result?: string;
  error?: string;
  retry_count?: number;
  started_at?: number;
  completed_at?: number;
}

export class TaskRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateTaskInput): Task {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, user_id, telegram_message_id, status, input_message,
        retry_count, created_at, updated_at
      ) VALUES (?, ?, ?, 'queued', ?, 0, ?, ?)
    `);

    stmt.run(
      input.id,
      input.user_id,
      input.telegram_message_id,
      input.input_message,
      now,
      now
    );

    return this.findById(input.id)!;
  }

  findById(id: string): Task | null {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByUserId(userId: number, limit = 50): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE user_id = ?
      ORDER BY created_at DESC LIMIT ?
    `);
    const rows = stmt.all(userId, limit) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  findByStatus(status: TaskStatus, limit = 100): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE status = ?
      ORDER BY created_at ASC LIMIT ?
    `);
    const rows = stmt.all(status, limit) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  findActive(limit = 100): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE status IN ('queued', 'planning', 'executing', 'verifying')
      ORDER BY created_at ASC LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  update(id: string, input: UpdateTaskInput): Task | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }

    if (input.plan !== undefined) {
      updates.push('plan = ?');
      values.push(JSON.stringify(input.plan));
    }

    if (input.execution_log !== undefined) {
      updates.push('execution_log = ?');
      values.push(JSON.stringify(input.execution_log));
    }

    if (input.result !== undefined) {
      updates.push('result = ?');
      values.push(input.result);
    }

    if (input.error !== undefined) {
      updates.push('error = ?');
      values.push(input.error);
    }

    if (input.retry_count !== undefined) {
      updates.push('retry_count = ?');
      values.push(input.retry_count);
    }

    if (input.started_at !== undefined) {
      updates.push('started_at = ?');
      values.push(input.started_at);
    }

    if (input.completed_at !== undefined) {
      updates.push('completed_at = ?');
      values.push(input.completed_at);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE tasks SET ${updates.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  private mapRow(row: any): Task {
    return {
      id: row.id,
      user_id: row.user_id,
      telegram_message_id: row.telegram_message_id,
      status: row.status as TaskStatus,
      input_message: row.input_message,
      plan: row.plan ? JSON.parse(row.plan) : null,
      execution_log: row.execution_log ? JSON.parse(row.execution_log) : null,
      result: row.result,
      error: row.error,
      retry_count: row.retry_count,
      started_at: row.started_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
