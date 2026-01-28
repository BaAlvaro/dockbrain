import type { Task } from '../../persistence/repositories/task-repository.js';
import type { TaskRepository } from '../../persistence/repositories/task-repository.js';
import type { PermissionRepository } from '../../persistence/repositories/permission-repository.js';
import type { AgentRuntime } from '../agent/agent-runtime.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { PermissionManager } from '../security/permission-manager.js';
import type { AuditLogger } from '../security/audit-logger.js';
import type { Logger } from '../../utils/logger.js';
import { TaskExecutor } from './task-executor.js';
import { TaskVerifier } from './task-verifier.js';
import type { ReminderRepository } from '../../persistence/repositories/reminder-repository.js';

export class TaskEngine {
  private executor: TaskExecutor;
  private verifier: TaskVerifier;
  private maxRetries: number;

  constructor(
    private taskRepo: TaskRepository,
    private permissionRepo: PermissionRepository,
    reminderRepo: ReminderRepository,
    private agentRuntime: AgentRuntime,
    private toolRegistry: ToolRegistry,
    private permissionManager: PermissionManager,
    private auditLogger: AuditLogger,
    private logger: Logger,
    maxRetries: number = 3,
    private memoryManager?: { recordInteraction: (userId: number, userMessage: string, assistantMessage: string) => Promise<void> }
  ) {
    this.executor = new TaskExecutor(toolRegistry, auditLogger, logger);
    this.verifier = new TaskVerifier(reminderRepo, logger);
    this.maxRetries = maxRetries;
  }

  async processTask(task: Task): Promise<Task> {
    try {
      this.logger.info({ taskId: task.id, userId: task.user_id }, 'Starting task processing');

      task = await this.planningPhase(task);

      if (task.status === 'failed') {
        return task;
      }

      task = await this.executionPhase(task);

      if (task.status === 'failed') {
        return task;
      }

      task = await this.verificationPhase(task);

      if (task.status === 'failed') {
        return task;
      }

      task = await this.completionPhase(task);

      return task;
    } catch (error: any) {
      this.logger.error({ taskId: task.id, error }, 'Task processing failed');
      return this.failTask(task, `Unexpected error: ${error.message}`);
    }
  }

  private async planningPhase(task: Task): Promise<Task> {
    this.logger.debug({ taskId: task.id }, 'Planning phase started');

    task.status = 'planning';
    task.started_at = Date.now();
    this.taskRepo.update(task.id, { status: task.status, started_at: task.started_at });

    const availableTools = this.getAvailableTools(task.user_id);

    if (availableTools.length === 0) {
      return this.failTask(task, 'No tools available for this user');
    }

    try {
      const quickPlan =
        this.tryBuildMemoryPlan(task.user_id, task.input_message, availableTools) ||
        this.tryBuildSystemExecPlan(task.user_id, task.input_message, availableTools);
      if (quickPlan) {
        if (!this.validatePlanPermissions(task.user_id, quickPlan)) {
          return this.failTask(task, 'Plan contains unauthorized tool usage');
        }

        task.plan = quickPlan;
        this.taskRepo.update(task.id, { plan: task.plan });
        this.logger.info({ taskId: task.id, steps: quickPlan.steps.length }, 'Planning phase completed');
        return task;
      }

      const plan = await this.agentRuntime.generatePlan({
        user_id: task.user_id,
        user_message: task.input_message,
        available_tools: availableTools,
      });

      if (!this.validatePlanPermissions(task.user_id, plan)) {
        return this.failTask(task, 'Plan contains unauthorized tool usage');
      }

      task.plan = plan;
      this.taskRepo.update(task.id, { plan: task.plan });

      this.logger.info({ taskId: task.id, steps: plan.steps.length }, 'Planning phase completed');
      return task;
    } catch (error: any) {
      return this.failTask(task, `Planning failed: ${error.message}`);
    }
  }

  private tryBuildMemoryPlan(userId: number, message: string, availableTools: string[]): any | null {
    if (!availableTools.includes('memory')) return null;
    if (!this.permissionManager.hasPermission(userId, 'memory', 'add')) return null;

    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();

    const rememberPrefixes = ['recuerda', 'recorda', 'remember', 'acuérdate', 'guardá', 'guarda'];
    const isRemember = rememberPrefixes.some((prefix) => lower.startsWith(prefix));

    if (!isRemember) return null;

    const content = trimmed.replace(/^[^a-zA-Z0-9áéíóúñü]+/i, '').replace(/^(recuerda|recorda|remember|acuérdate|guarda)\s*/i, '').trim();
    const finalContent = content.length > 0 ? content : trimmed;

    return {
      steps: [
        {
          id: 'step_1',
          tool: 'memory',
          action: 'add',
          params: {
            content: finalContent,
            category: 'context',
            relevance: 0.8,
          },
          requires_confirmation: false,
          verification: { type: 'data_retrieved', params: {} },
        },
      ],
      estimated_tools: ['memory'],
    };
  }

  private tryBuildSystemExecPlan(userId: number, message: string, availableTools: string[]): any | null {
    if (!availableTools.includes('system_exec')) return null;
    if (!this.permissionManager.hasPermission(userId, 'system_exec', 'run_command')) return null;

    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();

    const directMatch = trimmed.match(
      /^(ls|pwd|date|uptime|whoami|hostname|df|free|ip|ifconfig)(\s+.*)?$/i
    );
    let command: string | null = null;
    let args: string[] = [];

    if (directMatch) {
      command = directMatch[1].toLowerCase();
      const rest = (directMatch[2] || '').trim();
      if (rest) {
        args = rest.split(/\s+/).filter(Boolean);
      }
    } else if (/\bwhoami\b/.test(lower) || lower.includes('quien soy') || lower.includes('quién soy')) {
      command = 'whoami';
    } else if (/\bls\b/.test(lower) || /listar/.test(lower) || /archivos|carpetas|directorio/.test(lower)) {
      command = 'ls';
    } else if (lower.includes('pwd') || lower.includes('ruta actual')) {
      command = 'pwd';
    } else if (lower.includes('hora') || lower.includes('fecha') || lower.includes('date')) {
      command = 'date';
    } else if (lower.includes('uptime')) {
      command = 'uptime';
    } else if (lower.includes('quien soy') || lower.includes('whoami')) {
      command = 'whoami';
    } else if (lower.includes('hostname')) {
      command = 'hostname';
    } else if (lower.includes('crea') && (lower.includes('carpeta') || lower.includes('folder'))) {
      const folder = this.extractSafeName(trimmed, /(carpeta|folder)\s+(?:llamada\s+|nombre\s+)?["']?([^"'\n]+)["']?/i, 2);
      const file = this.extractSafeName(trimmed, /(archivo|file)\s+(?:llamado\s+|nombre\s+)?["']?([^"'\n]+)["']?/i, 2);
      if (!folder) return null;

      const parts: string[] = [];
      parts.push(`mkdir -p ${this.shellEscape(folder)}`);
      if (file) {
        parts.push(`touch ${this.shellEscape(`${folder}/${file}`)}`);
      }

      if (/\bls\b/.test(lower) || lower.includes('lista') || lower.includes('listar')) {
        parts.push('ls');
      }
      if (/\bpwd\b/.test(lower) || lower.includes('ruta') || lower.includes('direccion completa')) {
        parts.push('pwd');
      }

      return {
        steps: [
          {
            id: 'step_1',
            tool: 'system_exec',
            action: 'bash',
            params: {
              script: parts.join(' && '),
            },
            requires_confirmation: false,
            verification: { type: 'data_retrieved', params: {} },
          },
        ],
        estimated_tools: ['system_exec'],
      };
    }

    if (!command) return null;

    const pathMatch = trimmed.match(/(\/[^\s]+)/);
    if (pathMatch && args.length === 0) {
      args = [pathMatch[1]];
    }

    return {
      steps: [
        {
          id: 'step_1',
          tool: 'system_exec',
          action: 'run_command',
          params: {
            command,
            args,
          },
          requires_confirmation: false,
          verification: { type: 'data_retrieved', params: {} },
        },
      ],
      estimated_tools: ['system_exec'],
    };
  }

  private extractSafeName(input: string, pattern: RegExp, groupIndex: number): string | null {
    const match = input.match(pattern);
    const raw = match?.[groupIndex]?.trim();
    if (!raw) return null;
    if (!/^[a-zA-Z0-9 _.-]+$/.test(raw)) {
      return null;
    }
    if (raw.includes('/')) {
      return null;
    }
    return raw;
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, `'\"'\"'`)}'`;
  }

  private async executionPhase(task: Task): Promise<Task> {
    this.logger.debug({ taskId: task.id }, 'Execution phase started');

    task.status = 'executing';
    this.taskRepo.update(task.id, { status: task.status });

    if (!task.plan) {
      return this.failTask(task, 'No plan available');
    }

    const permissionSnapshot = this.permissionManager.createSnapshot(task.user_id);

    try {
      const executionLog = await this.executor.executeSteps(
        task.id,
        task.user_id,
        task.plan.steps,
        permissionSnapshot,
        task.input_message
      );

      task.execution_log = executionLog;
      this.taskRepo.update(task.id, { execution_log: task.execution_log });

      const hasErrors = executionLog.steps.some((s) => s.status === 'error');
      if (hasErrors && task.retry_count < this.maxRetries) {
        task.retry_count++;
        this.logger.warn({ taskId: task.id, retryCount: task.retry_count }, 'Retrying failed steps');
        return this.executionPhase(task);
      }

      if (hasErrors) {
        const firstError = executionLog.steps.find((s) => s.status === 'error');
        return this.failTask(task, `Execution failed: ${firstError?.error}`);
      }

      this.logger.info({ taskId: task.id }, 'Execution phase completed');
      return task;
    } catch (error: any) {
      return this.failTask(task, `Execution error: ${error.message}`);
    }
  }

  private async verificationPhase(task: Task): Promise<Task> {
    this.logger.debug({ taskId: task.id }, 'Verification phase started');

    task.status = 'verifying';
    this.taskRepo.update(task.id, { status: task.status });

    if (!task.plan || !task.execution_log) {
      return this.failTask(task, 'Missing plan or execution log');
    }

    try {
      const verificationResult = await this.verifier.verify(
        task.plan.steps,
        task.execution_log
      );

      if (!verificationResult.all_passed) {
        return this.failTask(
          task,
          `Verification failed: ${verificationResult.failures.join(', ')}`
        );
      }

      this.logger.info({ taskId: task.id }, 'Verification phase completed');
      return task;
    } catch (error: any) {
      return this.failTask(task, `Verification error: ${error.message}`);
    }
  }

  private async completionPhase(task: Task): Promise<Task> {
    this.logger.debug({ taskId: task.id }, 'Completion phase started');

    try {
      const finalResponse = await this.agentRuntime.generateFinalResponse(
        task.input_message,
        task.execution_log
      );

      task.status = 'done';
      task.result = finalResponse;
      task.completed_at = Date.now();

      this.taskRepo.update(task.id, {
        status: task.status,
        result: task.result,
        completed_at: task.completed_at,
      });

      this.auditLogger.logTaskEvent(task.user_id, task.id, 'task_completed', true);

      if (this.memoryManager) {
        await this.memoryManager.recordInteraction(task.user_id, task.input_message, finalResponse);
      }

      this.logger.info(
        { taskId: task.id, duration: task.completed_at - (task.started_at || 0) },
        'Task completed successfully'
      );

      return task;
    } catch (error: any) {
      return this.failTask(task, `Completion error: ${error.message}`);
    }
  }

  private failTask(task: Task, error: string): Task {
    task.status = 'failed';
    task.error = error;
    task.completed_at = Date.now();

    this.taskRepo.update(task.id, {
      status: task.status,
      error: task.error,
      completed_at: task.completed_at,
    });

    this.auditLogger.logTaskEvent(task.user_id, task.id, 'task_failed', false, error);

    this.logger.error({ taskId: task.id, error }, 'Task failed');

    return task;
  }

  private getAvailableTools(userId: number): string[] {
    const permissions = this.permissionRepo.findGrantedByUserId(userId);
    const toolNames = new Set<string>();

    for (const perm of permissions) {
      if (this.toolRegistry.has(perm.tool_name)) {
        toolNames.add(perm.tool_name);
      }
    }

    return Array.from(toolNames);
  }

  private validatePlanPermissions(userId: number, plan: any): boolean {
    for (const step of plan.steps) {
      if (!this.permissionManager.hasPermission(userId, step.tool, step.action)) {
        this.logger.warn(
          { userId, tool: step.tool, action: step.action },
          'Plan contains unauthorized tool usage'
        );
        return false;
      }
    }
    return true;
  }
}
