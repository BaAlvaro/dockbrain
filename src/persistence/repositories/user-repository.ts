import type Database from 'better-sqlite3';

export interface User {
  id: number;
  telegram_chat_id: string;
  username: string | null;
  display_name: string;
  paired_at: number;
  is_active: boolean;
  rate_limit_per_minute: number;
  created_at: number;
  updated_at: number;
}

export interface CreateUserInput {
  telegram_chat_id: string;
  username?: string;
  display_name: string;
  rate_limit_per_minute?: number;
}

export interface UpdateUserInput {
  is_active?: boolean;
  rate_limit_per_minute?: number;
  display_name?: string;
}

export class UserRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateUserInput): User {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO users (
        telegram_chat_id, username, display_name, paired_at,
        is_active, rate_limit_per_minute, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `);

    const info = stmt.run(
      input.telegram_chat_id,
      input.username || null,
      input.display_name,
      now,
      input.rate_limit_per_minute || 10,
      now,
      now
    );

    return this.findById(Number(info.lastInsertRowid))!;
  }

  findById(id: number): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByTelegramChatId(chatId: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE telegram_chat_id = ?');
    const row = stmt.get(chatId) as any;
    return row ? this.mapRow(row) : null;
  }

  findAll(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map((row) => this.mapRow(row));
  }

  findActive(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map((row) => this.mapRow(row));
  }

  update(id: number, input: UpdateUserInput): User | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(input.is_active ? 1 : 0);
    }

    if (input.rate_limit_per_minute !== undefined) {
      updates.push('rate_limit_per_minute = ?');
      values.push(input.rate_limit_per_minute);
    }

    if (input.display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(input.display_name);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  private mapRow(row: any): User {
    return {
      id: row.id,
      telegram_chat_id: row.telegram_chat_id,
      username: row.username,
      display_name: row.display_name,
      paired_at: row.paired_at,
      is_active: Boolean(row.is_active),
      rate_limit_per_minute: row.rate_limit_per_minute,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
