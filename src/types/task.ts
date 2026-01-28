import { z } from 'zod';

export const PlanStepSchema = z.object({
  id: z.string(),
  tool: z.string(),
  action: z.string(),
  params: z.record(z.any()).optional().default({}),
  requires_confirmation: z.boolean().default(false),
  verification: z.object({
    type: z.enum(['file_exists', 'reminder_created', 'data_retrieved', 'none']),
    params: z.record(z.any()).default({}),
  }),
});

export const ExecutionPlanSchema = z.object({
  steps: z.array(PlanStepSchema),
  estimated_tools: z.array(z.string()),
});

export const StepLogSchema = z.object({
  id: z.string(),
  tool: z.string().optional(),
  action: z.string().optional(),
  started_at: z.number(),
  completed_at: z.number().optional(),
  status: z.enum(['running', 'success', 'error']),
  result: z.any().optional(),
  error: z.string().optional(),
});

export const ExecutionLogSchema = z.object({
  steps: z.array(StepLogSchema),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;
export type StepLog = z.infer<typeof StepLogSchema>;
export type ExecutionLog = z.infer<typeof ExecutionLogSchema>;
