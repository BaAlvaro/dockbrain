import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Message Deduplication', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const migrationPath = join(__dirname, '../../../src/persistence/migrations/001_initial_schema.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    db.exec(migration);
  });

  it('should store dedup entry', () => {
    const stmt = db.prepare(`
      INSERT INTO message_dedup (telegram_message_id, telegram_chat_id, received_at, task_id)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(12345, '123456789', Date.now(), 'task_1');

    const checkStmt = db.prepare(`
      SELECT COUNT(*) as count FROM message_dedup
      WHERE telegram_chat_id = ? AND telegram_message_id = ?
    `);

    const result = checkStmt.get('123456789', 12345) as any;
    expect(result.count).toBe(1);
  });

  it('should prevent duplicate entries', () => {
    const stmt = db.prepare(`
      INSERT INTO message_dedup (telegram_message_id, telegram_chat_id, received_at, task_id)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(12345, '123456789', Date.now(), 'task_1');

    expect(() => {
      stmt.run(12345, '123456789', Date.now(), 'task_2');
    }).toThrow();
  });

  it('should allow same message_id from different chats', () => {
    const stmt = db.prepare(`
      INSERT INTO message_dedup (telegram_message_id, telegram_chat_id, received_at, task_id)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(12345, '123456789', Date.now(), 'task_1');
    stmt.run(12345, '987654321', Date.now(), 'task_2');

    const checkStmt = db.prepare(`
      SELECT COUNT(*) as count FROM message_dedup
      WHERE telegram_message_id = ?
    `);

    const result = checkStmt.get(12345) as any;
    expect(result.count).toBe(2);
  });

  it('should clean old entries', () => {
    const stmt = db.prepare(`
      INSERT INTO message_dedup (telegram_message_id, telegram_chat_id, received_at, task_id)
      VALUES (?, ?, ?, ?)
    `);

    const oldTimestamp = Date.now() - 400000;
    const recentTimestamp = Date.now();

    stmt.run(12345, '123456789', oldTimestamp, 'task_1');
    stmt.run(67890, '123456789', recentTimestamp, 'task_2');

    const deleteStmt = db.prepare(`
      DELETE FROM message_dedup WHERE received_at < ?
    `);
    const fiveMinutesAgo = Date.now() - 300000;
    deleteStmt.run(fiveMinutesAgo);

    const checkStmt = db.prepare(`
      SELECT COUNT(*) as count FROM message_dedup
    `);

    const result = checkStmt.get() as any;
    expect(result.count).toBe(1);
  });
});
