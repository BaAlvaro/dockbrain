import { z } from 'zod';

export const ConfigSchema = z.object({
  security: z.object({
    max_retry_attempts: z.number().int().min(0).max(10),
    task_timeout_ms: z.number().int().min(1000).max(600000),
    pairing_token_ttl_minutes: z.number().int().min(1).max(1440),
    rate_limit_per_minute: z.number().int().min(1).max(1000),
    web_allowed_domains: z.array(z.string()),
    web_blocked_ip_ranges: z.array(z.string()),
  }),

  llm: z.object({
    provider: z.enum(['openai', 'ollama', 'mock', 'gemini', 'openrouter']),
    model: z.string(),
    temperature: z.number().min(0).max(2),
    max_tokens: z.number().int().min(100).max(4000),
    timeout_ms: z.number().int().min(1000).max(120000),
  }),

  api: z.object({
    host: z.string(),
    port: z.number().int().min(1).max(65535),
  }),

  telegram: z.object({
    polling_timeout: z.number().int().min(1).max(300),
    max_concurrent_tasks: z.number().int().min(1).max(20),
  }),

  hooks: z.object({
    enabled: z.boolean(),
    token: z.string().min(1),
    gmail: z.object({
      enabled: z.boolean(),
      rules: z.array(
        z.object({
          name: z.string(),
          match: z.object({
            from: z.string().optional(),
            subject_contains: z.string().optional(),
          }),
          actions: z.array(
            z.object({
              type: z.literal('send_email'),
              to: z.string().email(),
              subject_template: z.string().optional(),
              body_template: z.string().optional(),
            })
          ),
        })
      ),
    }),
  }),

  tools: z.object({
    files_readonly: z.object({
      enabled: z.boolean(),
      max_file_size_mb: z.number().min(1).max(100),
      allowed_extensions: z.array(z.string()),
    }),
    reminders: z.object({
      enabled: z.boolean(),
      max_reminders_per_user: z.number().int().min(1).max(1000),
    }),
    web_sandbox: z.object({
      enabled: z.boolean(),
      timeout_ms: z.number().int().min(1000).max(30000),
      max_response_size_mb: z.number().min(1).max(50),
    }),
    system_info: z.object({
      enabled: z.boolean(),
    }),
    email: z.object({
      enabled: z.boolean(),
    }),
    gmail: z.object({
      enabled: z.boolean(),
    }),
    network_tools: z.object({
      enabled: z.boolean(),
      allowed_ssh_hosts: z.array(z.string()).default([]),
      ssh_timeout_ms: z.number().int().min(1000).max(60000).default(10000),
    }),
    codex_auth: z.object({
      enabled: z.boolean(),
      cli_path: z.string().optional(),
      codex_home: z.string().optional(),
      login_timeout_ms: z.number().int().min(1000).max(120000).default(60000),
    }),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
