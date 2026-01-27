import { z } from 'zod';

export interface ToolExecutionContext {
  user_id: number;
  task_id: string;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  actions: {
    [action: string]: {
      description: string;
      parameters: z.ZodSchema;
    };
  };
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}
