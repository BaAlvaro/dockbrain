import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';
import { ConfigSchema, type AppConfig } from '../../config/schema.js';

export function loadConfig(): AppConfig {
  const configPath = process.env.CONFIG_PATH || join(process.cwd(), 'config', 'default.yaml');
  const configFile = readFileSync(configPath, 'utf-8');
  const rawConfig = parse(configFile);

  const parsed = ConfigSchema.safeParse(rawConfig);

  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${parsed.error.message}`);
  }

  return parsed.data;
}

export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
}

export function getEnvVarOptional(key: string): string | undefined {
  return process.env[key];
}
