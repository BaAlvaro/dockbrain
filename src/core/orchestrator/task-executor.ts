import type { PlanStep, StepLog, ExecutionLog } from '../../types/task.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { PermissionSnapshot } from '../../types/permission.js';
import type { AuditLogger } from '../security/audit-logger.js';
import type { Logger } from '../../utils/logger.js';

export class TaskExecutor {
  constructor(
    private toolRegistry: ToolRegistry,
    private auditLogger: AuditLogger,
    private logger: Logger
  ) {}

  async executeSteps(
    taskId: string,
    userId: number,
    steps: PlanStep[],
    permissionSnapshot: PermissionSnapshot,
    userMessage?: string
  ): Promise<ExecutionLog> {
    const executionLog: ExecutionLog = { steps: [] };

    for (const step of steps) {
      const stepLog = await this.executeStep(taskId, userId, step, permissionSnapshot, userMessage);
      executionLog.steps.push(stepLog);

      if (stepLog.status === 'error') {
        this.logger.warn({ taskId, stepId: step.id, error: stepLog.error }, 'Step failed, stopping execution');
        break;
      }
    }

    return executionLog;
  }

  private async executeStep(
    taskId: string,
    userId: number,
    step: PlanStep,
    permissionSnapshot: PermissionSnapshot,
    userMessage?: string
  ): Promise<StepLog> {
    const stepLog: StepLog = {
      id: step.id,
      started_at: Date.now(),
      status: 'running',
    };

    try {
      const permCheck = this.checkPermission(permissionSnapshot, step.tool, step.action);

      if (!permCheck.granted) {
        throw new Error(`Permission denied: ${step.tool}.${step.action}`);
      }

      const tool = this.toolRegistry.get(step.tool);
      if (!tool) {
        throw new Error(`Tool not found: ${step.tool}`);
      }

      this.logger.debug(
        { taskId, stepId: step.id, tool: step.tool, action: step.action },
        'Executing step'
      );

      const result = await tool.execute(step.action, step.params, {
        user_id: userId,
        task_id: taskId,
        user_message: userMessage,
      });

      if (!result.success) {
        throw new Error(result.error || 'Tool execution failed');
      }

      stepLog.status = 'success';
      stepLog.result = result.data;
      stepLog.completed_at = Date.now();

      this.auditLogger.logToolInvocation(
        userId,
        taskId,
        step.tool,
        step.action,
        step.params,
        result
      );

      this.logger.info(
        { taskId, stepId: step.id, duration: stepLog.completed_at - stepLog.started_at },
        'Step completed successfully'
      );
    } catch (error: any) {
      stepLog.status = 'error';
      stepLog.error = error.message;
      stepLog.completed_at = Date.now();

      this.auditLogger.logToolInvocation(
        userId,
        taskId,
        step.tool,
        step.action,
        step.params,
        { success: false, error: error.message }
      );

      this.logger.error(
        { taskId, stepId: step.id, error: error.message },
        'Step failed'
      );
    }

    return stepLog;
  }

  private checkPermission(
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
}
