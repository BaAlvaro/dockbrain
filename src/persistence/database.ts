import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { mkdir } from 'fs/promises';

export class DatabaseClient {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dbDir = dirname(dbPath);

    try {
      mkdir(dbDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async runMigrations(): Promise<void> {
    const migrationPath =
      process.env.MIGRATIONS_PATH ||
      join(process.cwd(), 'src', 'persistence', 'migrations', '001_initial_schema.sql');
    const migration = readFileSync(migrationPath, 'utf-8');

    this.db.exec(migration);
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    return txn();
  }
}
