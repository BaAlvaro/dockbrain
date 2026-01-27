import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PairingManager } from '../../../src/core/security/pairing-manager.js';
import { PairingTokenRepository } from '../../../src/persistence/repositories/pairing-token-repository.js';
import { UserRepository } from '../../../src/persistence/repositories/user-repository.js';
import { createLogger } from '../../../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Pairing Manager', () => {
  let db: Database.Database;
  let pairingTokenRepo: PairingTokenRepository;
  let userRepo: UserRepository;
  let pairingManager: PairingManager;
  let logger: any;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const migrationPath = join(__dirname, '../../../src/persistence/migrations/001_initial_schema.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    db.exec(migration);

    pairingTokenRepo = new PairingTokenRepository(db);
    userRepo = new UserRepository(db);
    logger = createLogger();
    pairingManager = new PairingManager(pairingTokenRepo, userRepo, logger, 60);
  });

  it('should create a pairing token', () => {
    const result = pairingManager.createPairingToken();

    expect(result.token).toBeDefined();
    expect(result.token.length).toBe(24);
    expect(result.expires_at).toBeGreaterThan(Date.now());
  });

  it('should pair a user with valid token', async () => {
    const tokenResult = pairingManager.createPairingToken();

    const pairResult = await pairingManager.pairUser({
      token: tokenResult.token,
      telegram_chat_id: '123456789',
      display_name: 'Test User',
    });

    expect(pairResult.success).toBe(true);
    expect(pairResult.user_id).toBeDefined();
  });

  it('should reject pairing with invalid token', async () => {
    const pairResult = await pairingManager.pairUser({
      token: 'invalid_token',
      telegram_chat_id: '123456789',
      display_name: 'Test User',
    });

    expect(pairResult.success).toBe(false);
    expect(pairResult.error).toContain('Invalid or expired');
  });

  it('should reject pairing an already paired user', async () => {
    const tokenResult = pairingManager.createPairingToken();

    await pairingManager.pairUser({
      token: tokenResult.token,
      telegram_chat_id: '123456789',
      display_name: 'Test User',
    });

    const tokenResult2 = pairingManager.createPairingToken();

    const pairResult2 = await pairingManager.pairUser({
      token: tokenResult2.token,
      telegram_chat_id: '123456789',
      display_name: 'Test User',
    });

    expect(pairResult2.success).toBe(false);
    expect(pairResult2.error).toContain('already paired');
  });

  it('should mark token as used after pairing', async () => {
    const tokenResult = pairingManager.createPairingToken();

    await pairingManager.pairUser({
      token: tokenResult.token,
      telegram_chat_id: '123456789',
      display_name: 'Test User',
    });

    const isValid = pairingTokenRepo.isValid(tokenResult.token);
    expect(isValid).toBe(false);
  });

  it('should identify paired users correctly', async () => {
    const tokenResult = pairingManager.createPairingToken();

    await pairingManager.pairUser({
      token: tokenResult.token,
      telegram_chat_id: '123456789',
      display_name: 'Test User',
    });

    expect(pairingManager.isUserPaired('123456789')).toBe(true);
    expect(pairingManager.isUserPaired('999999999')).toBe(false);
  });
});
