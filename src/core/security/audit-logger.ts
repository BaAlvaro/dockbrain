import type { AuditRepository } from '../../persistence/repositories/audit-repository.js';
import type { Logger } from '../../utils/logger.js';

export interface AuditEvent {
  user_id?: number;
  task_id?: string;
  event_type: string;
  tool_name?: string;
  action?: string;
  input_data?: any;
  output_data?: any;
  success: boolean;
  error?: string;
}

export class AuditLogger {
  constructor(
    private auditRepo: AuditRepository,
    private logger: Logger
  ) {}

  log(event: AuditEvent): void {
    try {
      this.auditRepo.create(event);

      this.logger.info(
        {
          event_type: event.event_type,
          user_id: event.user_id,
          task_id: event.task_id,
          tool_name: event.tool_name,
          action: event.action,
          success: event.success,
        },
        'Audit event logged'
      );
    } catch (error) {
      this.logger.error({ error, event }, 'Failed to log audit event');
    }
  }

  logToolInvocation(
    userId: number,
    taskId: string,
    toolName: string,
    action: string,
    inputData: any,
    result: { success: boolean; data?: any; error?: string }
  ): void {
    this.log({
      user_id: userId,
      task_id: taskId,
      event_type: 'tool_invoked',
      tool_name: toolName,
      action,
      input_data: inputData,
      output_data: result.data,
      success: result.success,
      error: result.error,
    });
  }

  logTaskEvent(
    userId: number,
    taskId: string,
    eventType: string,
    success: boolean,
    error?: string
  ): void {
    this.log({
      user_id: userId,
      task_id: taskId,
      event_type: eventType,
      success,
      error,
    });
  }

  logSecurityEvent(
    eventType: string,
    userId?: number,
    details?: any
  ): void {
    this.log({
      user_id: userId,
      event_type: eventType,
      input_data: details,
      success: true,
    });
  }
}
