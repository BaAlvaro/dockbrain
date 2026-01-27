import type { LLMProvider, LLMMessage } from './llm-provider.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { ExecutionPlan } from '../../types/task.js';
import type { Logger } from '../../utils/logger.js';
import { ExecutionPlanSchema } from '../../types/task.js';

export interface PlanningContext {
  user_message: string;
  available_tools: string[];
}

export class AgentRuntime {
  constructor(
    private llmProvider: LLMProvider,
    private toolRegistry: ToolRegistry,
    private logger: Logger,
    private temperature: number = 0.1,
    private maxTokens: number = 1500
  ) {}

  async generatePlan(context: PlanningContext): Promise<ExecutionPlan> {
    const toolDescriptors = context.available_tools
      .map((name) => this.toolRegistry.getDescriptor(name))
      .filter((d) => d !== undefined);

    const systemPrompt = this.buildSystemPrompt(toolDescriptors);
    const userPrompt = this.buildUserPrompt(context.user_message);

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    this.logger.debug({ messages }, 'Generating plan with LLM');

    const response = await this.llmProvider.complete({
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    });

    this.logger.debug({ response: response.content, usage: response.usage }, 'LLM response received');

    let planData: any;
    try {
      planData = JSON.parse(response.content);
    } catch (error) {
      throw new Error('LLM response is not valid JSON');
    }

    const validatedPlan = ExecutionPlanSchema.parse(planData);

    this.logger.info(
      { steps: validatedPlan.steps.length, tools: validatedPlan.estimated_tools },
      'Plan generated successfully'
    );

    return validatedPlan;
  }

  async generateFinalResponse(userMessage: string, executionLog: any): Promise<string> {
    const systemPrompt = `You are DockBrain, a helpful task execution assistant.
Generate a friendly, concise response to the user based on the execution results.
Keep it short (2-3 sentences maximum). Use the user's language.`;

    const userPrompt = `User request: "${userMessage}"

Execution results:
${JSON.stringify(executionLog, null, 2)}

Generate a natural language response for the user.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llmProvider.complete({
      messages,
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.content.trim();
  }

  private buildSystemPrompt(toolDescriptors: any[]): string {
    return `You are DockBrain, a task execution planning assistant.

Your role is to generate a structured execution plan in JSON format.

Available tools:
${JSON.stringify(toolDescriptors, null, 2)}

CRITICAL RULES:
1. Only use tools from the available tools list
2. Each step must specify: id, tool, action, params, requires_confirmation, verification
3. Set requires_confirmation to true for destructive actions (delete, modify files)
4. Choose appropriate verification type: file_exists, reminder_created, data_retrieved, or none
5. Return ONLY valid JSON, no additional text

Response format:
{
  "steps": [
    {
      "id": "step_1",
      "tool": "tool_name",
      "action": "action_name",
      "params": { "param1": "value1" },
      "requires_confirmation": false,
      "verification": {
        "type": "reminder_created",
        "params": {}
      }
    }
  ],
  "estimated_tools": ["tool_name"]
}`;
  }

  private buildUserPrompt(userMessage: string): string {
    return `User request: "${userMessage}"

Generate the execution plan in JSON format.`;
  }
}
