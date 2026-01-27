import pino from 'pino';
import { join } from 'path';

export function createLogger(logsDir?: string) {
  const isDev = process.env.NODE_ENV !== 'production';

  const config: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    redact: {
      paths: [
        'token',
        'password',
        'secret',
        'api_key',
        'apiKey',
        'authorization',
        '*.token',
        '*.password',
        '*.secret',
        '*.api_key',
      ],
      remove: true,
    },
  };

  if (isDev) {
    return pino({
      ...config,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  if (logsDir) {
    const logFile = join(logsDir, 'dockbrain.log');
    return pino(config, pino.destination(logFile));
  }

  return pino(config);
}

export type Logger = ReturnType<typeof createLogger>;
