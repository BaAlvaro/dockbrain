import Database from 'better-sqlite3';

export class ConfigStoreRepository {
  constructor(private db: Database.Database) {}

  get(key: string): string | undefined {
    const stmt = this.db.prepare(`
      SELECT value FROM config_store WHERE key = ?
    `);
    const row = stmt.get(key) as any;
    return row?.value;
  }

  set(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO config_store (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, value, Date.now());
  }

  getJson<T = any>(key: string): T | undefined {
    const value = this.get(key);
    if (!value) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }

  setJson(key: string, value: any): void {
    this.set(key, JSON.stringify(value));
  }
}
