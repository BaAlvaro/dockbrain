import type { ToolExecutionContext, ToolExecutionResult, ToolDescriptor } from '../types/tool.js';
import type { Logger } from '../utils/logger.js';

export abstract class BaseTool {
  constructor(protected logger: Logger) {}

  abstract getName(): string;
  abstract getDescription(): string;
  abstract getActions(): ToolDescriptor['actions'];

  getDescriptor(): ToolDescriptor {
    return {
      name: this.getName(),
      description: this.getDescription(),
      actions: this.getActions(),
    };
  }

  async execute(
    action: string,
    params: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const actions = this.getActions();

    if (!actions[action]) {
      return {
        success: false,
        error: `Unknown action: ${action}`,
      };
    }

    try {
      const validatedParams = actions[action].parameters.parse(params);
      return await this.executeAction(action, validatedParams, context);
    } catch (error: any) {
      this.logger.error({ error, action, params }, 'Tool execution failed');
      return {
        success: false,
        error: error.message || 'Tool execution failed',
      };
    }
  }

  protected abstract executeAction(
    action: string,
    params: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult>;
}
