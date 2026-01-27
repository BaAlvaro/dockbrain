import type Database from 'better-sqlite3';

export interface PairingToken {
  id: number;
  token: string;
  created_at: number;
  expires_at: number;
  used_at: number | null;
  used_by_chat_id: string | null;
  is_admin: boolean;
}

export interface CreatePairingTokenInput {
  token: string;
  ttl_minutes: number;
  is_admin?: boolean;
}

export class PairingTokenRepository {
  constructor(private db: Database.Database) {}

  create(input: CreatePairingTokenInput): PairingToken {
    const now = Date.now();
    const expiresAt = now + input.ttl_minutes * 60 * 1000;

    const stmt = this.db.prepare(`
      INSERT INTO pairing_tokens (token, created_at, expires_at, is_admin)
      VALUES (?, ?, ?, ?)
    `);

    const info = stmt.run(
      input.token,
      now,
      expiresAt,
      input.is_admin ? 1 : 0
    );

    return this.findById(Number(info.lastInsertRowid))!;
  }

  findById(id: number): PairingToken | null {
    const stmt = this.db.prepare('SELECT * FROM pairing_tokens WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByToken(token: string): PairingToken | null {
    const stmt = this.db.prepare('SELECT * FROM pairing_tokens WHERE token = ?');
    const row = stmt.get(token) as any;
    return row ? this.mapRow(row) : null;
  }

  findActive(): PairingToken[] {
    const now = Date.now();
    const stmt = this.db.prepare(`
      SELECT * FROM pairing_tokens
      WHERE used_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(now) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  markUsed(token: string, chatId: string): PairingToken | null {
    const stmt = this.db.prepare(`
      UPDATE pairing_tokens
      SET used_at = ?, used_by_chat_id = ?
      WHERE token = ?
    `);

    stmt.run(Date.now(), chatId, token);
    return this.findByToken(token);
  }

  isValid(token: string): boolean {
    const pairingToken = this.findByToken(token);
    if (!pairingToken) {
      return false;
    }

    const now = Date.now();
    return pairingToken.used_at === null && pairingToken.expires_at > now;
  }

  cleanExpired(): number {
    const now = Date.now();
    const stmt = this.db.prepare(`
      DELETE FROM pairing_tokens
      WHERE expires_at < ? AND used_at IS NULL
    `);
    const info = stmt.run(now);
    return info.changes;
  }

  private mapRow(row: any): PairingToken {
    return {
      id: row.id,
      token: row.token,
      created_at: row.created_at,
      expires_at: row.expires_at,
      used_at: row.used_at,
      used_by_chat_id: row.used_by_chat_id,
      is_admin: Boolean(row.is_admin),
    };
  }
}
