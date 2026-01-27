import type { Task, TaskStatus } from '../../persistence/repositories/task-repository.js';
import type { TaskRepository } from '../../persistence/repositories/task-repository.js';
import type { PermissionRepository } from '../../persistence/repositories/permission-repository.js';
import type { UserRepository } from '../../persistence/repositories/user-repository.js';
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
    private userRepo: UserRepository,
    private permissionRepo: PermissionRepository,
    private reminderRepo: ReminderRepository,
    private agentRuntime: AgentRuntime,
    private toolRegistry: ToolRegistry,
    private permissionManager: PermissionManager,
    private auditLogger: AuditLogger,
    private logger: Logger,
    maxRetries: number = 3
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
      const plan = await this.agentRuntime.generatePlan({
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
        permissionSnapshot
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
