import { z } from 'zod';
import { platform, uptime, version } from 'os';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';

export class SystemInfoTool extends BaseTool {
  constructor(logger: Logger) {
    super(logger);
  }

  getName(): string {
    return 'system_info';
  }

  getDescription(): string {
    return 'Get basic system information';
  }

  getActions() {
    return {
      get: {
        description: 'Get system information',
        parameters: z.object({}),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    switch (action) {
      case 'get':
        return this.getSystemInfo();
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private getSystemInfo(): ToolExecutionResult {
    return {
      success: true,
      data: {
        platform: platform(),
        uptime_seconds: uptime(),
        node_version: version(),
        dockbrain_version: '0.1.0',
      },
    };
  }
}
