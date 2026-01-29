import type { LLMProvider, LLMMessage } from './llm-provider.js';
import { z } from 'zod';
import type { ToolRegistry } from '../../tools/registry.js';
import type { ExecutionPlan } from '../../types/task.js';
import type { Logger } from '../../utils/logger.js';
import { ExecutionPlanSchema } from '../../types/task.js';

export interface PlanningContext {
  user_id: number;
  user_message: string;
  available_tools: string[];
}

export class AgentRuntime {
  constructor(
    private llmProvider: LLMProvider,
    private toolRegistry: ToolRegistry,
    private logger: Logger,
    private temperature: number = 0.1,
    private maxTokens: number = 1500,
    private memoryManager?: { getUserMemory: (userId: number) => Promise<any> },
    private memoryConfig?: { include_in_prompt: boolean; max_entries: number }
  ) {}

  async generatePlan(context: PlanningContext): Promise<ExecutionPlan> {
    const toolDescriptors = context.available_tools
      .map((name) => this.toolRegistry.getDescriptor(name))
      .filter((d) => d !== undefined);

    const systemPrompt = this.buildSystemPrompt(toolDescriptors);
    const memoryContext = await this.buildMemoryContext(context.user_id);
    const userPrompt = this.buildUserPrompt(
      context.user_message,
      memoryContext ?? undefined
    );

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
      // Try to extract JSON block if the model added extra text.
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          planData = JSON.parse(jsonMatch[0]);
        } catch {
          // fallthrough to retry
        }
      }

      // One retry with strict instruction
      const retryMessages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            `${userPrompt}\n\nYour previous response was invalid JSON. ` +
            `Return ONLY valid JSON, no extra text, no markdown.`,
        },
      ];

      const retryResponse = await this.llmProvider.complete({
        messages: retryMessages,
        temperature: 0.1,
        max_tokens: this.maxTokens,
      });

      try {
        planData = JSON.parse(retryResponse.content);
      } catch {
        const retryJsonMatch = retryResponse.content.match(/\{[\s\S]*\}/);
        if (retryJsonMatch) {
          planData = JSON.parse(retryJsonMatch[0]);
        } else {
          throw new Error('LLM response is not valid JSON');
        }
      }
    }

    const validatedPlan = ExecutionPlanSchema.parse(planData);

    this.logger.info(
      { steps: validatedPlan.steps.length, tools: validatedPlan.estimated_tools },
      'Plan generated successfully'
    );

    return validatedPlan;
  }

  async generateFinalResponse(userMessage: string, executionLog: any): Promise<string> {
    const toolResponse = this.tryBuildToolResponse(executionLog, userMessage);
    if (toolResponse) {
      return toolResponse;
    }

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

  private tryBuildToolResponse(executionLog: any, userMessage?: string): string | null {
    const steps = executionLog?.steps || [];
    const lastStep = steps[steps.length - 1];
    if (!lastStep || lastStep.status !== 'success') {
      return null;
    }

    const result = lastStep.result || {};
    const tool = lastStep.tool;
    const action = lastStep.action;

    if (tool === 'memory' && action === 'add' && result.content) {
      return `Listo. Lo recordaré: "${result.content}".`;
    }

    if (tool === 'memory' && action === 'search') {
      const items = Array.isArray(result.results) ? result.results : [];
      if (items.length === 0) {
        return 'No encontré recuerdos relacionados con eso.';
      }
      const top = items[0];
      if (top?.key === 'project_name' && top?.value) {
        return `Tu proyecto se llama ${top.value}.`;
      }
      if (top?.key === 'user_name' && top?.value) {
        return `Tu nombre es ${top.value}.`;
      }
      const lines = items.slice(0, 3).map((m: any) => `- ${m.content}`);
      return `Esto es lo que recuerdo:\n${lines.join('\n')}`;
    }

    if (tool === 'files_write' && result.path) {
      switch (action) {
        case 'write':
          return `Archivo guardado en ${result.path}.`;
        case 'append':
          return `Contenido añadido en ${result.path}.`;
        case 'edit':
          return `Archivo actualizado en ${result.path}.`;
        case 'delete':
          return `Archivo eliminado: ${result.path}.`;
      }
    }

    if (tool === 'system_exec') {
      const stdout = result.stdout?.trim() || '';
      const stderr = result.stderr?.trim() || '';
      if (stdout && stderr) {
        return `Salida:\n${stdout}\n\nErrores:\n${stderr}`;
      }
      if (stdout) {
        return `Salida:\n${stdout}`;
      }
      if (stderr) {
        return `Errores:\n${stderr}`;
      }
      return 'Comando ejecutado.';
    }

    if (result.reminder_id && result.remind_at && result.message) {
      const date = new Date(result.remind_at);
      const formatted = this.formatLocalDateTime(date);
      return `Listo. Te recordaré: "${result.message}" el ${formatted}.`;
    }

    if (Array.isArray(result.reminders)) {
      if (result.reminders.length === 0) {
        return 'No tienes recordatorios activos.';
      }

      const normalized = (userMessage || '').toLowerCase();
      const wantsRemaining =
        normalized.includes('cuánto falta') ||
        normalized.includes('cuanto falta') ||
        normalized.includes('cuándo me avisas') ||
        normalized.includes('cuando me avisas') ||
        normalized.includes('para cuándo') ||
        normalized.includes('cuando es el recordatorio');

      if (wantsRemaining) {
        const next = result.reminders[0];
        const remindAt = new Date(next.remind_at).getTime();
        const now = Date.now();
        const diffMs = Math.max(0, remindAt - now);
        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        const remainingMinutes = minutes % 60;
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (remainingHours > 0) parts.push(`${remainingHours}h`);
        parts.push(`${remainingMinutes}m`);
        return `Faltan ${parts.join(' ')} para "${next.message}".`;
      }

      const lines = result.reminders.map((r: any) => {
        const date = new Date(r.remind_at);
        return `- ${r.message} (${this.formatLocalDateTime(date)})`;
      });

      return `Tus recordatorios:\n${lines.join('\n')}`;
    }

    return null;
  }

  private formatLocalDateTime(date: Date): string {
    try {
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date.toISOString();
    }
  }

  private buildSystemPrompt(toolDescriptors: any[]): string {
    const toolSummaries = toolDescriptors.map((tool) => ({
      name: tool.name,
      description: tool.description,
      actions: Object.fromEntries(
        Object.entries(tool.actions).map(([actionName, action]: any) => [
          actionName,
          {
            description: action.description,
            params_schema: this.describeSchema(action.parameters),
          },
        ])
      ),
    }));

    return `You are DockBrain, a task execution planning assistant.

Your role is to generate a structured execution plan in JSON format.

Available tools:
${JSON.stringify(toolSummaries, null, 2)}

CRITICAL RULES:
1. Only use tools from the available tools list
2. Each step must specify: id, tool, action, params, requires_confirmation, verification
3. Set requires_confirmation to true for destructive actions (delete, modify files)
4. Choose appropriate verification type: file_exists, reminder_created, data_retrieved, or none
5. If no tool is needed (greetings, small talk, acknowledgements), return an EMPTY plan
6. Return ONLY valid JSON, no additional text
7. If the user asks you to remember something, use the memory tool (action: add)
8. If the user asks about past info, preferences, or "what did I say", use memory tool (action: search)
9. Never claim file changes unless a files_write tool step was executed

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

  private buildUserPrompt(userMessage: string, memoryContext?: string): string {
    const memoryBlock = memoryContext ? `\n\nUser memory context:\n${memoryContext}\n` : '';
    return `User request: "${userMessage}"
${memoryBlock}

If this does not require any tool (e.g., greeting or small talk), return:
{ "steps": [], "estimated_tools": [] }

Generate the execution plan in JSON format.`;
  }

  private async buildMemoryContext(userId: number): Promise<string | null> {
    if (!this.memoryManager || !this.memoryConfig?.include_in_prompt) {
      return null;
    }

    try {
      const memory = await this.memoryManager.getUserMemory(userId);
      const profile = memory?.profile || {};
      const memories = Array.isArray(memory?.memories) ? memory.memories : [];

      const recent = memories.slice(-this.memoryConfig.max_entries).reverse();

      const profileParts = [
        profile.name ? `name=${profile.name}` : null,
        profile.telegram ? `telegram=${profile.telegram}` : null,
      ].filter(Boolean);

      const lines: string[] = [];
      if (profileParts.length > 0) {
        lines.push(`Profile: ${profileParts.join(', ')}`);
      }

      const prefs = profile.preferences || {};
      const prefKeys = Object.keys(prefs);
      if (prefKeys.length > 0) {
        const prefSummary = prefKeys.slice(0, 5).map((key) => `${key}=${String(prefs[key])}`);
        lines.push(`Preferences: ${prefSummary.join(', ')}`);
      }

      if (recent.length > 0) {
        lines.push('Recent memories:');
        for (const entry of recent) {
          lines.push(`- (${entry.category}) ${entry.content}`);
        }
      }

      return lines.length > 0 ? lines.join('\n') : null;
    } catch (error: any) {
      this.logger.warn({ error, userId }, 'Failed to load memory context');
      return null;
    }
  }

  private describeSchema(schema: z.ZodSchema): any {
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      return Object.fromEntries(
        Object.entries(shape).map(([key, value]) => [key, this.describeSchema(value as z.ZodSchema)])
      );
    }

    if (schema instanceof z.ZodString) {
      const checks = (schema as any)._def?.checks || [];
      const hasDatetime = checks.some((check: any) => check.kind === 'datetime');
      return hasDatetime ? 'string (ISO 8601 datetime)' : 'string';
    }

    if (schema instanceof z.ZodNumber) {
      return 'number';
    }

    if (schema instanceof z.ZodBoolean) {
      return 'boolean';
    }

    if (schema instanceof z.ZodArray) {
      return `array<${this.describeSchema(schema.element)}>`;
    }

    if (schema instanceof z.ZodEnum) {
      return `enum(${schema.options.join(', ')})`;
    }

    return 'unknown';
  }
}
