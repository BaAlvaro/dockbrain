import type { PermissionRepository } from '../../persistence/repositories/permission-repository.js';
import type { PermissionSnapshot } from '../../types/permission.js';
import type { Logger } from '../../utils/logger.js';

export class PermissionManager {
  constructor(
    private permissionRepo: PermissionRepository,
    private logger: Logger
  ) {}

  hasPermission(userId: number, toolName: string, action: string): boolean {
    const has = this.permissionRepo.hasPermission(userId, toolName, action);
    this.logger.debug({ userId, toolName, action, has }, 'Permission check');
    return has;
  }

  requiresConfirmation(userId: number, toolName: string, action: string): boolean {
    return this.permissionRepo.requiresConfirmation(userId, toolName, action);
  }

  createSnapshot(userId: number): PermissionSnapshot {
    const permissions = this.permissionRepo.findGrantedByUserId(userId);
    const snapshot: PermissionSnapshot = {};

    for (const perm of permissions) {
      const key = `${perm.tool_name}:${perm.action}`;
      snapshot[key] = {
        granted: perm.granted,
        requires_confirmation: perm.requires_confirmation,
      };
    }

    this.logger.debug({ userId, snapshotKeys: Object.keys(snapshot) }, 'Created permission snapshot');
    return snapshot;
  }

  checkAgainstSnapshot(
    snapshot: PermissionSnapshot,
    toolName: string,
    action: string
  ): { granted: boolean; requires_confirmation: boolean } {
    const exactKey = `${toolName}:${action}`;
    const wildcardKey = `${toolName}:*`;

    if (snapshot[exactKey]) {
      return snapshot[exactKey];
    }

    if (snapshot[wildcardKey]) {
      return snapshot[wildcardKey];
    }

    return { granted: false, requires_confirmation: false };
  }

  grantDefaultPermissions(userId: number): void {
    const defaultPermissions = [
      { tool_name: 'system_info', action: '*', granted: true, requires_confirmation: false },
      { tool_name: 'reminders', action: 'create', granted: true, requires_confirmation: false },
      { tool_name: 'reminders', action: 'list', granted: true, requires_confirmation: false },
      { tool_name: 'reminders', action: 'delete', granted: true, requires_confirmation: true },
    ];

    for (const perm of defaultPermissions) {
      this.permissionRepo.create({
        user_id: userId,
        ...perm,
        granted_by: 'system',
      });
    }

    this.logger.info({ userId }, 'Granted default permissions');
  }
}
