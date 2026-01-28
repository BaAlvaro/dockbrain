import { z } from 'zod';
import { networkInterfaces, hostname, userInfo } from 'os';
import { isIP } from 'net';
import { promises as fs } from 'fs';
import { createConnection } from 'net';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';

const execFileAsync = promisify(execFile);

const DESTRUCTIVE_PATTERNS = [
  /rm\s+-rf/i,
  /\brm\s+-r\b/i,
  /\bdd\s+if=/i,
  /\bmkfs/i,
  /\bfdisk\b/i,
  />\s*\/dev\//i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
  /\binit\s+0\b/i,
  /\binit\s+6\b/i,
];

const MAX_COMMAND_LENGTH = 2000;
const MAX_OUTPUT_LENGTH = 10000;

export class NetworkToolsTool extends BaseTool {
  constructor(
    logger: Logger,
    private allowedSshHosts: string[] = [],
    private sshTimeoutMs: number = 10000
  ) {
    super(logger);
  }

  getName(): string {
    return 'network_tools';
  }

  getDescription(): string {
    return 'Network and SSH utilities for server management';
  }

  getActions() {
    return {
      get_server_ip: {
        description: 'Get the public IP address of the server',
        parameters: z.object({}),
      },
      get_local_ips: {
        description: 'Get all local network interface IP addresses',
        parameters: z.object({}),
      },
      get_ssh_info: {
        description: 'Get SSH connection information for the current server',
        parameters: z.object({}),
      },
      execute_ssh_command: {
        description: 'Execute a command on a remote server via SSH',
        parameters: z.object({
          host: z.string().min(1).max(255).regex(/^[a-zA-Z0-9.-]+$/),
          user: z.string().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/),
          command: z.string().min(1).max(MAX_COMMAND_LENGTH),
          port: z.number().int().min(1).max(65535).optional().default(22),
          use_key: z.boolean().optional().default(true),
        }),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    switch (action) {
      case 'get_server_ip':
        return this.getServerPublicIp();
      case 'get_local_ips':
        return this.getLocalIps();
      case 'get_ssh_info':
        return this.getSshInfo();
      case 'execute_ssh_command':
        return this.executeSshCommand(params, context);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async getServerPublicIp(): Promise<ToolExecutionResult> {
    const services = [
      'https://api.ipify.org',
      'https://ifconfig.me/ip',
      'https://icanhazip.com',
    ];

    for (const service of services) {
      try {
        const ipText = await this.fetchText(service, 5000);
        const ip = ipText.trim();

        if (isIP(ip)) {
          return {
            success: true,
            data: {
              public_ip: ip,
              source: service,
            },
          };
        }
      } catch (error: any) {
        this.logger.warn({ service, error: error.message }, 'Failed to fetch public IP');
      }
    }

    return {
      success: false,
      error: 'Could not determine public IP from any service',
    };
  }

  private getLocalIps(): ToolExecutionResult {
    try {
      const interfaces = networkInterfaces();
      const ips: { interface: string; ip: string; family: string }[] = [];

      for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;

        for (const addr of addrs) {
          if (addr.internal) continue;

          ips.push({
            interface: name,
            ip: addr.address,
            family: addr.family,
          });
        }
      }

      return {
        success: true,
        data: {
          local_ips: ips,
          count: ips.length,
        },
      };
    } catch (error: any) {
      this.logger.error({ error }, 'Failed to get local IPs');
      return {
        success: false,
        error: `Failed to get local IPs: ${error.message}`,
      };
    }
  }

  private async getSshInfo(): Promise<ToolExecutionResult> {
    try {
      const publicIpResult = await this.getServerPublicIp();
      const publicIp = publicIpResult.success ? publicIpResult.data?.public_ip : null;

      const sshPort = await this.readSshPort();
      const sshRunning = await this.isPortOpen(sshPort);
      const currentUser = userInfo().username;

      const hostForCommand = publicIp || hostname();

      return {
        success: true,
        data: {
          public_ip: publicIp || 'unknown',
          hostname: hostname(),
          current_user: currentUser,
          ssh_running: sshRunning,
          ssh_port: sshPort,
          ssh_command: `ssh ${currentUser}@${hostForCommand} -p ${sshPort}`,
        },
      };
    } catch (error: any) {
      this.logger.error({ error }, 'Failed to get SSH info');
      return {
        success: false,
        error: `Failed to get SSH info: ${error.message}`,
      };
    }
  }

  private async executeSshCommand(
    params: {
      host: string;
      user: string;
      command: string;
      port: number;
      use_key: boolean;
    },
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    if (!this.isHostAllowed(params.host)) {
      return {
        success: false,
        error: `SSH host "${params.host}" is not in the allowed list.`,
      };
    }

    if (params.command.includes('\n') || params.command.includes('\r') || params.command.includes('\0')) {
      return {
        success: false,
        error: 'SSH command contains invalid characters',
      };
    }

    for (const pattern of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(params.command)) {
        return {
          success: false,
          error: `Command "${params.command}" contains potentially destructive operations and is blocked by default`,
        };
      }
    }

    try {
      const args = [
        '-p',
        params.port.toString(),
        '-o',
        'BatchMode=yes',
        '-o',
        'StrictHostKeyChecking=accept-new',
      ];

      if (params.use_key) {
        args.push('-o', 'PasswordAuthentication=no');
      }

      args.push(`${params.user}@${params.host}`, params.command);

      const { stdout, stderr } = await execFileAsync('ssh', args, {
        timeout: this.sshTimeoutMs,
        maxBuffer: 1024 * 1024,
      });

      return {
        success: true,
        data: {
          stdout: this.truncateOutput(stdout),
          stderr: this.truncateOutput(stderr),
          command: params.command,
          host: params.host,
          user: params.user,
        },
      };
    } catch (error: any) {
      this.logger.error({ error, params }, 'SSH command execution failed');

      if (error.killed && error.signal === 'SIGTERM') {
        return {
          success: false,
          error: `SSH command timed out after ${this.sshTimeoutMs}ms`,
        };
      }

      return {
        success: false,
        error: `SSH command failed: ${error.message}`,
        data: {
          stdout: this.truncateOutput(error.stdout || ''),
          stderr: this.truncateOutput(error.stderr || ''),
        },
      };
    }
  }

  private isHostAllowed(host: string): boolean {
    if (this.allowedSshHosts.length === 0) {
      return false;
    }

    if (this.allowedSshHosts.includes('*')) {
      return true;
    }

    return this.allowedSshHosts.some((allowed) => {
      if (allowed === host) {
        return true;
      }

      if (isIP(allowed)) {
        return false;
      }

      return host.endsWith(`.${allowed}`);
    });
  }

  private async fetchText(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'DockBrain/0.1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async readSshPort(): Promise<number> {
    try {
      const config = await fs.readFile('/etc/ssh/sshd_config', 'utf-8');
      const lines = config.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const match = trimmed.match(/^Port\s+(\d+)/i);
        if (match) {
          const port = parseInt(match[1], 10);
          if (Number.isInteger(port) && port > 0 && port <= 65535) {
            return port;
          }
        }
      }
    } catch {
      // ignore and fall back to default
    }

    return 22;
  }

  private async isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection({ host: '127.0.0.1', port, timeout: 500 });

      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  private truncateOutput(output: string): string {
    if (!output) {
      return '';
    }

    if (output.length <= MAX_OUTPUT_LENGTH) {
      return output.trim();
    }

    return `${output.slice(0, MAX_OUTPUT_LENGTH).trim()}... [truncated]`;
  }
}
