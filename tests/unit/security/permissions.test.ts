import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PermissionManager } from '../../../src/core/security/permission-manager.js';
import { PermissionRepository } from '../../../src/persistence/repositories/permission-repository.js';
import { UserRepository } from '../../../src/persistence/repositories/user-repository.js';
import { createLogger } from '../../../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Permission Manager', () => {
  let db: Database.Database;
  let permissionRepo: PermissionRepository;
  let userRepo: UserRepository;
  let permissionManager: PermissionManager;
  let logger: any;
  let userId: number;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const migrationPath = join(__dirname, '../../../src/persistence/migrations/001_initial_schema.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    db.exec(migration);

    permissionRepo = new PermissionRepository(db);
    userRepo = new UserRepository(db);
    logger = createLogger();
    permissionManager = new PermissionManager(permissionRepo, logger);

    const user = userRepo.create({
      telegram_chat_id: '123456789',
      display_name: 'Test User',
    });
    userId = user.id;
  });

  it('should grant default permissions', () => {
    permissionManager.grantDefaultPermissions(userId);

    expect(permissionManager.hasPermission(userId, 'system_info', 'get')).toBe(true);
    expect(permissionManager.hasPermission(userId, 'reminders', 'create')).toBe(true);
    expect(permissionManager.hasPermission(userId, 'reminders', 'list')).toBe(true);
    expect(permissionManager.hasPermission(userId, 'network_tools', 'get_server_ip')).toBe(true);
  });

  it('should deny permission for unauthorized tool', () => {
    permissionManager.grantDefaultPermissions(userId);

    expect(permissionManager.hasPermission(userId, 'files_readonly', 'read')).toBe(false);
  });

  it('should support wildcard permissions', () => {
    permissionRepo.create({
      user_id: userId,
      tool_name: 'reminders',
      action: '*',
      granted: true,
    });

    expect(permissionManager.hasPermission(userId, 'reminders', 'create')).toBe(true);
    expect(permissionManager.hasPermission(userId, 'reminders', 'delete')).toBe(true);
    expect(permissionManager.hasPermission(userId, 'reminders', 'list')).toBe(true);
  });

  it('should create permission snapshot', () => {
    permissionManager.grantDefaultPermissions(userId);

    const snapshot = permissionManager.createSnapshot(userId);

    expect(snapshot['system_info:*']).toBeDefined();
    expect(snapshot['system_info:*'].granted).toBe(true);
    expect(snapshot['reminders:create']).toBeDefined();
    expect(snapshot['reminders:create'].granted).toBe(true);
  });

  it('should check permissions against snapshot', () => {
    permissionManager.grantDefaultPermissions(userId);
    const snapshot = permissionManager.createSnapshot(userId);

    const result = permissionManager.checkAgainstSnapshot(snapshot, 'reminders', 'create');

    expect(result.granted).toBe(true);
    expect(result.requires_confirmation).toBe(false);
  });

  it('should respect requires_confirmation flag', () => {
    permissionManager.grantDefaultPermissions(userId);

    expect(permissionManager.requiresConfirmation(userId, 'reminders', 'delete')).toBe(true);
    expect(permissionManager.requiresConfirmation(userId, 'reminders', 'create')).toBe(false);
  });
});
