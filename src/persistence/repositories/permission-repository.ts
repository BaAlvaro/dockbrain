import type Database from 'better-sqlite3';

export interface Permission {
  id: number;
  user_id: number;
  tool_name: string;
  action: string;
  granted: boolean;
  requires_confirmation: boolean;
  granted_at: number;
  granted_by: string | null;
}

export interface CreatePermissionInput {
  user_id: number;
  tool_name: string;
  action: string;
  granted: boolean;
  requires_confirmation?: boolean;
  granted_by?: string;
}

export class PermissionRepository {
  constructor(private db: Database.Database) {}

  create(input: CreatePermissionInput): Permission {
    const stmt = this.db.prepare(`
      INSERT INTO permissions (
        user_id, tool_name, action, granted, requires_confirmation,
        granted_at, granted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, tool_name, action) DO UPDATE SET
        granted = excluded.granted,
        requires_confirmation = excluded.requires_confirmation,
        granted_at = excluded.granted_at,
        granted_by = excluded.granted_by
    `);

    stmt.run(
      input.user_id,
      input.tool_name,
      input.action,
      input.granted ? 1 : 0,
      input.requires_confirmation ? 1 : 0,
      Date.now(),
      input.granted_by || null
    );

    return this.findByUserAndToolAction(input.user_id, input.tool_name, input.action)!;
  }

  findByUserId(userId: number): Permission[] {
    const stmt = this.db.prepare('SELECT * FROM permissions WHERE user_id = ?');
    const rows = stmt.all(userId) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  findGrantedByUserId(userId: number): Permission[] {
    const stmt = this.db.prepare('SELECT * FROM permissions WHERE user_id = ? AND granted = 1');
    const rows = stmt.all(userId) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  findByUserAndToolAction(userId: number, toolName: string, action: string): Permission | null {
    const stmt = this.db.prepare(`
      SELECT * FROM permissions
      WHERE user_id = ? AND tool_name = ? AND action = ?
    `);
    const row = stmt.get(userId, toolName, action) as any;
    return row ? this.mapRow(row) : null;
  }

  hasPermission(userId: number, toolName: string, action: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM permissions
      WHERE user_id = ? AND tool_name = ? AND (action = ? OR action = '*') AND granted = 1
    `);
    const result = stmt.get(userId, toolName, action) as any;
    return result.count > 0;
  }

  requiresConfirmation(userId: number, toolName: string, action: string): boolean {
    const stmt = this.db.prepare(`
      SELECT requires_confirmation FROM permissions
      WHERE user_id = ? AND tool_name = ? AND (action = ? OR action = '*') AND granted = 1
      LIMIT 1
    `);
    const result = stmt.get(userId, toolName, action) as any;
    return result ? Boolean(result.requires_confirmation) : false;
  }

  setPermissions(userId: number, permissions: CreatePermissionInput[]): void {
    const deletStmt = this.db.prepare('DELETE FROM permissions WHERE user_id = ?');
    deletStmt.run(userId);

    for (const perm of permissions) {
      this.create({ ...perm, user_id: userId });
    }
  }

  deleteByUserId(userId: number): void {
    const stmt = this.db.prepare('DELETE FROM permissions WHERE user_id = ?');
    stmt.run(userId);
  }

  private mapRow(row: any): Permission {
    return {
      id: row.id,
      user_id: row.user_id,
      tool_name: row.tool_name,
      action: row.action,
      granted: Boolean(row.granted),
      requires_confirmation: Boolean(row.requires_confirmation),
      granted_at: row.granted_at,
      granted_by: row.granted_by,
    };
  }
}
