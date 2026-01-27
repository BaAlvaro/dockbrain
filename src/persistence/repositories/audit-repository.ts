import type Database from 'better-sqlite3';

export interface AuditLog {
  id: number;
  timestamp: number;
  user_id: number | null;
  task_id: string | null;
  event_type: string;
  tool_name: string | null;
  action: string | null;
  input_data: any | null;
  output_data: any | null;
  success: boolean;
  error: string | null;
}

export interface CreateAuditLogInput {
  user_id?: number;
  task_id?: string;
  event_type: string;
  tool_name?: string;
  action?: string;
  input_data?: any;
  output_data?: any;
  success: boolean;
  error?: string;
}

export class AuditRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateAuditLogInput): AuditLog {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (
        timestamp, user_id, task_id, event_type, tool_name, action,
        input_data, output_data, success, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      Date.now(),
      input.user_id || null,
      input.task_id || null,
      input.event_type,
      input.tool_name || null,
      input.action || null,
      input.input_data ? JSON.stringify(this.redactSensitive(input.input_data)) : null,
      input.output_data ? JSON.stringify(this.redactSensitive(input.output_data)) : null,
      input.success ? 1 : 0,
      input.error || null
    );

    return this.findById(Number(info.lastInsertRowid))!;
  }

  findById(id: number): AuditLog | null {
    const stmt = this.db.prepare('SELECT * FROM audit_logs WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByUserId(userId: number, limit = 100): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs WHERE user_id = ?
      ORDER BY timestamp DESC LIMIT ?
    `);
    const rows = stmt.all(userId, limit) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  findByTaskId(taskId: string): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs WHERE task_id = ?
      ORDER BY timestamp ASC
    `);
    const rows = stmt.all(taskId) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  findByTimeRange(fromTimestamp: number, toTimestamp: number, limit = 1000): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC LIMIT ?
    `);
    const rows = stmt.all(fromTimestamp, toTimestamp, limit) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  findByEventType(eventType: string, limit = 100): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs WHERE event_type = ?
      ORDER BY timestamp DESC LIMIT ?
    `);
    const rows = stmt.all(eventType, limit) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  private redactSensitive(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const redacted = { ...data };
    const sensitiveKeys = ['token', 'password', 'secret', 'key', 'api_key', 'auth'];

    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = this.redactSensitive(redacted[key]);
      }
    }

    return redacted;
  }

  private mapRow(row: any): AuditLog {
    return {
      id: row.id,
      timestamp: row.timestamp,
      user_id: row.user_id,
      task_id: row.task_id,
      event_type: row.event_type,
      tool_name: row.tool_name,
      action: row.action,
      input_data: row.input_data ? JSON.parse(row.input_data) : null,
      output_data: row.output_data ? JSON.parse(row.output_data) : null,
      success: Boolean(row.success),
      error: row.error,
    };
  }
}
