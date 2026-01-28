import { z } from 'zod';
import path from 'path';
import { promisify } from 'util';
import { exec, execFile } from 'child_process';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const SAFE_TOKEN = /^[a-zA-Z0-9._:/=+@%-]+$/;
const MAX_ARGS = 32;
const MAX_ARG_LENGTH = 200;

const RESTRICTED_COMMANDS = new Set(['ufw', 'systemctl', 'journalctl']);
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /\bdd\s+if=/i,
  /\bmkfs/i,
  /:\(\)\s*\{.*\}/, // fork bomb
];

export class SystemExecTool extends BaseTool {
  constructor(
    logger: Logger,
    private allowedCommands: string[],
    private blockedCommands: string[],
    private allowedSystemctlActions: string[],
    private allowedSystemctlUnits: string[],
    private allowedUfwActions: string[],
    private maxOutputBytes: number,
    private defaultTimeoutMs: number,
    private allowedWorkingDirs: string[]
  ) {
    super(logger);
  }

  getName(): string {
    return 'system_exec';
  }

  getDescription(): string {
    return 'Run a small set of allowlisted Linux commands with safety checks';
  }

  getActions() {
    return {
      run_command: {
        description: 'Run an allowlisted command (no shell)',
        parameters: z.object({
          command: z.string().min(1).max(64),
          args: z.array(z.string().min(1).max(MAX_ARG_LENGTH)).max(MAX_ARGS).optional().default([]),
          timeout_ms: z.number().int().min(1000).max(120000).optional(),
          working_dir: z.string().min(1).max(512).optional(),
        }),
      },
      execute: {
        description: 'Execute a shell command (allowlist enforced)',
        parameters: z.object({
          command: z.string().min(1),
          cwd: z.string().min(1).max(512).optional(),
          timeout_ms: z.number().int().min(1000).max(120000).optional(),
          env: z.record(z.string()).optional(),
        }),
      },
      bash: {
        description: 'Execute a bash script (allowlist enforced)',
        parameters: z.object({
          script: z.string().min(1),
          timeout_ms: z.number().int().min(1000).max(120000).optional(),
        }),
      },
      systemctl_status: {
        description: 'systemctl status <unit>',
        parameters: z.object({
          unit: z.string().min(1).max(256),
        }),
      },
      systemctl_start: {
        description: 'systemctl start <unit>',
        parameters: z.object({
          unit: z.string().min(1).max(256),
        }),
      },
      systemctl_stop: {
        description: 'systemctl stop <unit>',
        parameters: z.object({
          unit: z.string().min(1).max(256),
        }),
      },
      systemctl_restart: {
        description: 'systemctl restart <unit>',
        parameters: z.object({
          unit: z.string().min(1).max(256),
        }),
      },
      ufw_status: {
        description: 'ufw status',
        parameters: z.object({}),
      },
      ufw_enable: {
        description: 'ufw enable',
        parameters: z.object({}),
      },
      ufw_disable: {
        description: 'ufw disable',
        parameters: z.object({}),
      },
      ufw_allow: {
        description: 'ufw allow <rule>',
        parameters: z.object({
          rule: z.string().min(1).max(200),
        }),
      },
      ufw_deny: {
        description: 'ufw deny <rule>',
        parameters: z.object({
          rule: z.string().min(1).max(200),
        }),
      },
      ufw_delete: {
        description: 'ufw delete <rule>',
        parameters: z.object({
          rule: z.string().min(1).max(200),
        }),
      },
      ufw_reload: {
        description: 'ufw reload',
        parameters: z.object({}),
      },
      journalctl_tail: {
        description: 'journalctl -u <unit> -n <lines>',
        parameters: z.object({
          unit: z.string().min(1).max(256),
          lines: z.number().int().min(10).max(500).optional().default(100),
        }),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    switch (action) {
      case 'run_command':
        return this.runCommand(params.command, params.args, params.timeout_ms, params.working_dir);
      case 'execute':
        return this.runShellCommand(params.command, params.cwd, params.timeout_ms, params.env);
      case 'bash':
        return this.runBashScript(params.script, params.timeout_ms);
      case 'systemctl_status':
        return this.runSystemctl('status', params.unit);
      case 'systemctl_start':
        return this.runSystemctl('start', params.unit);
      case 'systemctl_stop':
        return this.runSystemctl('stop', params.unit);
      case 'systemctl_restart':
        return this.runSystemctl('restart', params.unit);
      case 'ufw_status':
        return this.runUfw('status');
      case 'ufw_enable':
        return this.runUfw('enable');
      case 'ufw_disable':
        return this.runUfw('disable');
      case 'ufw_allow':
        return this.runUfw('allow', params.rule);
      case 'ufw_deny':
        return this.runUfw('deny', params.rule);
      case 'ufw_delete':
        return this.runUfw('delete', params.rule);
      case 'ufw_reload':
        return this.runUfw('reload');
      case 'journalctl_tail':
        return this.runJournalctl(params.unit, params.lines);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async runCommand(
    command: string,
    args: string[],
    timeoutMs?: number,
    workingDir?: string
  ): Promise<ToolExecutionResult> {
    if (!this.isAllowedCommand(command)) {
      return { success: false, error: `Command "${command}" is not allowed` };
    }

    if (RESTRICTED_COMMANDS.has(command)) {
      return { success: false, error: `Use the dedicated action for "${command}"` };
    }

    const validatedArgs = this.validateArgs(args);
    if (!validatedArgs.success) {
      return validatedArgs;
    }

    const cwdResult = this.resolveWorkingDir(workingDir);
    if (!cwdResult.success) {
      return cwdResult;
    }

    return this.exec(command, validatedArgs.data, timeoutMs, cwdResult.data);
  }

  private async runShellCommand(
    command: string,
    cwd?: string,
    timeoutMs?: number,
    env?: Record<string, string>
  ): Promise<ToolExecutionResult> {
    if (!this.isShellCommandAllowed(command)) {
      return { success: false, error: 'Command not allowed by allowlist' };
    }

    const cwdResult = this.resolveWorkingDir(cwd);
    if (!cwdResult.success) {
      return cwdResult;
    }

    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwdResult.data,
        timeout,
        env: { ...process.env, ...env },
        maxBuffer: this.maxOutputBytes,
      });

      return {
        success: true,
        data: {
          command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          timeout_ms: timeout,
        },
      };
    } catch (error: any) {
      this.logger.error({ error, command }, 'Shell command failed');
      return {
        success: false,
        error: error.message || 'Command failed',
        data: {
          stdout: (error.stdout || '').toString().trim(),
          stderr: (error.stderr || '').toString().trim(),
          timeout_ms: timeout,
        },
      };
    }
  }

  private async runBashScript(script: string, timeoutMs?: number): Promise<ToolExecutionResult> {
    if (!this.isShellCommandAllowed(script)) {
      return { success: false, error: 'Script not allowed by allowlist' };
    }

    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    try {
      const { stdout, stderr } = await execAsync(script, {
        timeout,
        maxBuffer: this.maxOutputBytes,
        shell: '/bin/bash',
      });

      return {
        success: true,
        data: {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          timeout_ms: timeout,
        },
      };
    } catch (error: any) {
      this.logger.error({ error }, 'Bash script failed');
      return {
        success: false,
        error: error.message || 'Script failed',
        data: {
          stdout: (error.stdout || '').toString().trim(),
          stderr: (error.stderr || '').toString().trim(),
          timeout_ms: timeout,
        },
      };
    }
  }

  private async runSystemctl(action: string, unit: string): Promise<ToolExecutionResult> {
    if (!this.allowedSystemctlActions.includes(action)) {
      return { success: false, error: `systemctl action "${action}" is not allowed` };
    }

    if (!this.isAllowedUnit(unit)) {
      return { success: false, error: `systemctl unit "${unit}" is not allowed` };
    }

    return this.exec('systemctl', [action, unit]);
  }

  private async runUfw(action: string, rule?: string): Promise<ToolExecutionResult> {
    if (!this.allowedUfwActions.includes(action)) {
      return { success: false, error: `ufw action "${action}" is not allowed` };
    }

    const args = [action];

    if (rule) {
      const tokens = rule.trim().split(/\s+/).filter(Boolean);
      const validatedArgs = this.validateArgs(tokens, true);
      if (!validatedArgs.success) {
        return validatedArgs;
      }
      args.push(...validatedArgs.data);
    }

    return this.exec('ufw', args);
  }

  private async runJournalctl(unit: string, lines: number): Promise<ToolExecutionResult> {
    if (!this.isAllowedUnit(unit)) {
      return { success: false, error: `journalctl unit "${unit}" is not allowed` };
    }

    return this.exec('journalctl', ['-u', unit, '-n', String(lines), '--no-pager']);
  }

  private isAllowedCommand(command: string): boolean {
    if (this.blockedCommands.includes(command)) return false;
    return this.allowedCommands.includes(command);
  }

  private isShellCommandAllowed(command: string): boolean {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return false;
      }
    }

    const segments = command.split(/[\n;|&]+/).map((segment) => segment.trim()).filter(Boolean);
    if (segments.length === 0) return false;

    for (const segment of segments) {
      const token = segment.split(/\s+/)[0];
      if (!token || !this.isAllowedCommand(token)) {
        return false;
      }
    }

    return true;
  }

  private isAllowedUnit(unit: string): boolean {
    if (this.allowedSystemctlUnits.includes('*')) return true;
    return this.allowedSystemctlUnits.includes(unit);
  }

  private validateArgs(args: string[], allowEmpty = false): ToolExecutionResult & { data?: string[] } {
    if (!allowEmpty && args.length === 0) {
      return { success: true, data: [] };
    }

    if (args.length > MAX_ARGS) {
      return { success: false, error: 'Too many arguments' };
    }

    for (const arg of args) {
      if (arg.length > MAX_ARG_LENGTH) {
        return { success: false, error: 'Argument too long' };
      }
      if (!SAFE_TOKEN.test(arg)) {
        return { success: false, error: `Argument "${arg}" contains invalid characters` };
      }
      if (arg.startsWith('-')) {
        return { success: false, error: `Argument "${arg}" looks like a flag and is not allowed` };
      }
    }

    return { success: true, data: args };
  }

  private resolveWorkingDir(workingDir?: string): ToolExecutionResult & { data?: string } {
    if (!workingDir) {
      return { success: true, data: undefined };
    }

    if (this.allowedWorkingDirs.length === 0) {
      return { success: false, error: 'Custom working_dir is not allowed' };
    }

    const resolved = path.resolve(workingDir);
    const isAllowed = this.allowedWorkingDirs.some((allowed) => {
      const base = path.resolve(allowed);
      return resolved === base || resolved.startsWith(`${base}${path.sep}`);
    });

    if (!isAllowed) {
      return { success: false, error: `working_dir "${workingDir}" is not allowed` };
    }

    return { success: true, data: resolved };
  }

  private async exec(
    command: string,
    args: string[],
    timeoutMs?: number,
    cwd?: string
  ): Promise<ToolExecutionResult> {
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout,
        maxBuffer: this.maxOutputBytes,
        cwd,
      });

      return {
        success: true,
        data: {
          command,
          args,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          timeout_ms: timeout,
        },
      };
    } catch (error: any) {
      this.logger.error({ error, command, args }, 'System command failed');

      const stdout = (error.stdout || '').toString().trim();
      const stderr = (error.stderr || '').toString().trim();

      return {
        success: false,
        error: error.message || 'Command failed',
        data: {
          command,
          args,
          stdout,
          stderr,
          timeout_ms: timeout,
        },
      };
    }
  }
}
