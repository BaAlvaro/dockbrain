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
      { tool_name: 'network_tools', action: 'get_server_ip', granted: true, requires_confirmation: false },
      { tool_name: 'network_tools', action: 'get_local_ips', granted: true, requires_confirmation: false },
      { tool_name: 'network_tools', action: 'get_ssh_info', granted: true, requires_confirmation: false },
      { tool_name: 'network_tools', action: 'execute_ssh_command', granted: false, requires_confirmation: true },
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

  grantAdminPermissions(userId: number): void {
    const adminPermissions = [
      { tool_name: 'system_info', action: '*', granted: true, requires_confirmation: false },
      { tool_name: 'reminders', action: 'create', granted: true, requires_confirmation: false },
      { tool_name: 'reminders', action: 'list', granted: true, requires_confirmation: false },
      { tool_name: 'reminders', action: 'delete', granted: true, requires_confirmation: true },
      { tool_name: 'network_tools', action: 'get_server_ip', granted: true, requires_confirmation: false },
      { tool_name: 'network_tools', action: 'get_local_ips', granted: true, requires_confirmation: false },
      { tool_name: 'network_tools', action: 'get_ssh_info', granted: true, requires_confirmation: false },
      { tool_name: 'network_tools', action: 'execute_ssh_command', granted: true, requires_confirmation: true },
      { tool_name: 'files_readonly', action: '*', granted: true, requires_confirmation: false },
      { tool_name: 'files_write', action: 'write', granted: true, requires_confirmation: true },
      { tool_name: 'files_write', action: 'append', granted: true, requires_confirmation: false },
      { tool_name: 'files_write', action: 'edit', granted: true, requires_confirmation: true },
      { tool_name: 'files_write', action: 'delete', granted: true, requires_confirmation: true },
      { tool_name: 'web_sandbox', action: 'fetch', granted: true, requires_confirmation: false },
      { tool_name: 'browser', action: 'navigate', granted: true, requires_confirmation: false },
      { tool_name: 'browser', action: 'screenshot', granted: true, requires_confirmation: false },
      { tool_name: 'browser', action: 'extract_data', granted: true, requires_confirmation: false },
      { tool_name: 'browser', action: 'fill_form', granted: true, requires_confirmation: true },
      { tool_name: 'browser', action: 'click', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'run_command', granted: true, requires_confirmation: false },
      { tool_name: 'system_exec', action: 'execute', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'bash', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'systemctl_status', granted: true, requires_confirmation: false },
      { tool_name: 'system_exec', action: 'systemctl_start', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'systemctl_stop', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'systemctl_restart', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'ufw_status', granted: true, requires_confirmation: false },
      { tool_name: 'system_exec', action: 'ufw_enable', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'ufw_disable', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'ufw_allow', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'ufw_deny', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'ufw_delete', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'ufw_reload', granted: true, requires_confirmation: true },
      { tool_name: 'system_exec', action: 'journalctl_tail', granted: true, requires_confirmation: false },
      { tool_name: 'memory', action: 'add', granted: true, requires_confirmation: false },
      { tool_name: 'memory', action: 'search', granted: true, requires_confirmation: false },
      { tool_name: 'sessions', action: 'spawn', granted: true, requires_confirmation: false },
      { tool_name: 'sessions', action: 'list', granted: true, requires_confirmation: false },
      { tool_name: 'sessions', action: 'send', granted: true, requires_confirmation: false },
      { tool_name: 'sessions', action: 'destroy', granted: true, requires_confirmation: true },
      { tool_name: 'skills', action: 'list', granted: true, requires_confirmation: false },
      { tool_name: 'skills', action: 'run', granted: true, requires_confirmation: true },
      { tool_name: 'email', action: 'send', granted: true, requires_confirmation: true },
      { tool_name: 'gmail', action: 'send', granted: true, requires_confirmation: true },
      { tool_name: 'codex_auth', action: 'login_chatgpt', granted: true, requires_confirmation: true },
      { tool_name: 'codex_auth', action: 'login_api_key', granted: true, requires_confirmation: true },
      { tool_name: 'codex_auth', action: 'status', granted: true, requires_confirmation: false },
      { tool_name: 'codex_auth', action: 'logout', granted: true, requires_confirmation: true },
    ];

    for (const perm of adminPermissions) {
      this.permissionRepo.create({
        user_id: userId,
        ...perm,
        granted_by: 'system',
      });
    }

    this.logger.info({ userId }, 'Granted admin permissions');
  }
}
