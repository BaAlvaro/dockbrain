import type { PlanStep, ExecutionLog } from '../../types/task.js';
import type { Logger } from '../../utils/logger.js';
import type { ReminderRepository } from '../../persistence/repositories/reminder-repository.js';
import { existsSync } from 'fs';

export interface VerificationResult {
  all_passed: boolean;
  failures: string[];
}

export class TaskVerifier {
  constructor(
    private reminderRepo: ReminderRepository,
    private logger: Logger
  ) {}

  async verify(steps: PlanStep[], executionLog: ExecutionLog): Promise<VerificationResult> {
    const result: VerificationResult = {
      all_passed: true,
      failures: [],
    };

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepLog = executionLog.steps[i];

      if (!stepLog || stepLog.status !== 'success') {
        continue;
      }

      const verification = step.verification;

      try {
        switch (verification.type) {
          case 'reminder_created':
            await this.verifyReminderCreated(step, stepLog, result);
            break;

          case 'file_exists':
            await this.verifyFileExists(step, stepLog, result, verification.params);
            break;

          case 'data_retrieved':
            await this.verifyDataRetrieved(step, stepLog, result);
            break;

          case 'none':
            break;

          default:
            result.all_passed = false;
            result.failures.push(`Step ${step.id}: unknown verification type`);
        }
      } catch (error: any) {
        this.logger.error({ error, step: step.id }, 'Verification error');
        result.all_passed = false;
        result.failures.push(`Step ${step.id}: verification error - ${error.message}`);
      }
    }

    return result;
  }

  private async verifyReminderCreated(
    step: PlanStep,
    stepLog: any,
    result: VerificationResult
  ): Promise<void> {
    if (!stepLog.result?.reminder_id) {
      result.all_passed = false;
      result.failures.push(`Step ${step.id}: no reminder_id in result`);
      return;
    }

    const reminder = this.reminderRepo.findById(stepLog.result.reminder_id);
    if (!reminder) {
      result.all_passed = false;
      result.failures.push(`Step ${step.id}: reminder not found in database`);
    }
  }

  private async verifyFileExists(
    step: PlanStep,
    stepLog: any,
    result: VerificationResult,
    params: any
  ): Promise<void> {
    const filePath = params.path || stepLog.result?.path;

    if (!filePath) {
      result.all_passed = false;
      result.failures.push(`Step ${step.id}: no file path specified`);
      return;
    }

    if (!existsSync(filePath)) {
      result.all_passed = false;
      result.failures.push(`Step ${step.id}: file not found at ${filePath}`);
    }
  }

  private async verifyDataRetrieved(
    step: PlanStep,
    stepLog: any,
    result: VerificationResult
  ): Promise<void> {
    if (!stepLog.result || Object.keys(stepLog.result).length === 0) {
      result.all_passed = false;
      result.failures.push(`Step ${step.id}: no data retrieved`);
    }
  }
}
