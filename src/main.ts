import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { createLogger } from './utils/logger.js';
import { loadConfig, getEnvVar, getEnvVarOptional } from './utils/config-loader.js';
import { DatabaseClient } from './persistence/database.js';
import { UserRepository } from './persistence/repositories/user-repository.js';
import { PermissionRepository } from './persistence/repositories/permission-repository.js';
import { TaskRepository } from './persistence/repositories/task-repository.js';
import { ReminderRepository } from './persistence/repositories/reminder-repository.js';
import { AuditRepository } from './persistence/repositories/audit-repository.js';
import { PairingTokenRepository } from './persistence/repositories/pairing-token-repository.js';
import { ConfigStoreRepository } from './persistence/repositories/config-store-repository.js';
import { PermissionManager } from './core/security/permission-manager.js';
import { PairingManager } from './core/security/pairing-manager.js';
import { AuditLogger } from './core/security/audit-logger.js';
import { ToolRegistry } from './tools/registry.js';
import { AgentRuntime } from './core/agent/agent-runtime.js';
import { MockLLMProvider } from './core/agent/providers/mock-provider.js';
import { OpenAIProvider } from './core/agent/providers/openai-provider.js';
import { OllamaProvider } from './core/agent/providers/ollama-provider.js';
import { GeminiProvider } from './core/agent/providers/gemini-provider.js';
import { OpenRouterProvider } from './core/agent/providers/openrouter-provider.js';
import { TaskEngine } from './core/orchestrator/task-engine.js';
import { RateLimiter } from './core/gateway/rate-limiter.js';
import { Gateway } from './core/gateway/gateway.js';
import { ApiServer } from './core/gateway/api-server.js';
import { TelegramConnector } from './connectors/telegram/telegram-connector.js';
import { GmailService } from './core/integrations/gmail-service.js';

async function main() {
  const logger = createLogger();

  logger.info('Starting DockBrain...');

  try {
    const config = loadConfig();
    logger.info('Configuration loaded');

    const databasePath = getEnvVar('DATABASE_PATH', './data/dockbrain.db');
    const logsDir = getEnvVar('LOGS_DIR', './data/logs');
    const safeRootDir = getEnvVar('SAFE_ROOT_DIR', './data/safe_root');
    const telegramBotToken = getEnvVar('TELEGRAM_BOT_TOKEN');
    const adminApiToken = getEnvVar('ADMIN_API_TOKEN');

    await ensureDirectoriesExist([
      databasePath.substring(0, databasePath.lastIndexOf('/')),
      logsDir,
      safeRootDir,
    ]);

    const dbClient = new DatabaseClient(databasePath);
    await dbClient.runMigrations();
    const db = dbClient.getDatabase();
    logger.info('Database initialized');

    const userRepo = new UserRepository(db);
    const permissionRepo = new PermissionRepository(db);
    const taskRepo = new TaskRepository(db);
    const reminderRepo = new ReminderRepository(db);
    const auditRepo = new AuditRepository(db);
    const pairingTokenRepo = new PairingTokenRepository(db);

    const permissionManager = new PermissionManager(permissionRepo, logger);
    const pairingManager = new PairingManager(
      pairingTokenRepo,
      userRepo,
      logger,
      config.security.pairing_token_ttl_minutes
    );
    const auditLogger = new AuditLogger(auditRepo, logger);

    const configStore = new ConfigStoreRepository(db);
    const toolRegistry = new ToolRegistry(logger, reminderRepo, config, safeRootDir, configStore);

    const llmProvider = createLLMProvider(config, logger);
    const agentRuntime = new AgentRuntime(
      llmProvider,
      toolRegistry,
      logger,
      config.llm.temperature,
      config.llm.max_tokens
    );

    const taskEngine = new TaskEngine(
      taskRepo,
      permissionRepo,
      reminderRepo,
      agentRuntime,
      toolRegistry,
      permissionManager,
      auditLogger,
      logger,
      config.security.max_retry_attempts
    );

    const rateLimiter = new RateLimiter(logger, config.security.rate_limit_per_minute);

    let telegramConnector: TelegramConnector | null = null;

    const gateway = new Gateway(
      db,
      taskRepo,
      userRepo,
      taskEngine,
      rateLimiter,
      logger,
      async (userId: number, _taskId: string, result: string) => {
        const user = userRepo.findById(userId);
        if (user && telegramConnector) {
          await telegramConnector.sendMessage(user.telegram_chat_id, result);
        }
      }
    );

    const hookToken =
      getEnvVarOptional('HOOKS_TOKEN') ||
      configStore.get('hooks.token') ||
      config.hooks.token;
    const gmailService =
      config.hooks.gmail.enabled || configStore.get('hooks.gmail.enabled') === 'true'
        ? new GmailService(configStore)
        : null;

    const apiServer = new ApiServer(
      logger,
      pairingManager,
      userRepo,
      taskRepo,
      auditRepo,
      pairingTokenRepo,
      permissionRepo,
      config,
      gmailService,
      hookToken,
      configStore,
      adminApiToken,
      config.api.host,
      config.api.port
    );

    telegramConnector = new TelegramConnector(
      logger,
      gateway,
      pairingManager,
      permissionManager,
      userRepo,
      telegramBotToken,
      configStore
    );

    await telegramConnector.start();

    logger.info('DockBrain started successfully');

    const cleanupTokensInterval = setInterval(() => {
      pairingManager.cleanExpiredTokens();
    }, 3600000);

    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      clearInterval(cleanupTokensInterval);
      await telegramConnector?.stop();
      await apiServer.close();
      dbClient.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down...');
      clearInterval(cleanupTokensInterval);
      await telegramConnector?.stop();
      await apiServer.close();
      dbClient.close();
      process.exit(0);
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to start DockBrain');
    process.exit(1);
  }
}

function createLLMProvider(config: any, logger: any) {
  const provider = getEnvVarOptional('LLM_PROVIDER') || config.llm.provider;

  if (provider === 'mock') {
    logger.info('Using Mock LLM provider');
    return new MockLLMProvider(logger);
  }

  if (provider === 'openai') {
    const apiKey = getEnvVar('OPENAI_API_KEY');
    logger.info({ model: config.llm.model }, 'Using OpenAI LLM provider');
    return new OpenAIProvider(logger, apiKey, config.llm.model);
  }

  if (provider === 'ollama') {
    const baseUrl = getEnvVarOptional('OLLAMA_BASE_URL') || 'http://localhost:11434';
    const model = getEnvVarOptional('OLLAMA_MODEL') || config.llm.model || 'llama3.2';
    logger.info({ model, baseUrl }, 'Using Ollama LLM provider');
    return new OllamaProvider(logger, baseUrl, model);
  }

  if (provider === 'gemini') {
    const apiKey = getEnvVar('GEMINI_API_KEY');
    const model = getEnvVarOptional('GEMINI_MODEL') || config.llm.model || 'gemini-2.5-flash';
    logger.info({ model }, 'Using Gemini LLM provider');
    return new GeminiProvider(logger, apiKey, model);
  }

  if (provider === 'openrouter') {
    const apiKey = getEnvVar('OPENROUTER_API_KEY');
    const modelsValue =
      getEnvVarOptional('OPENROUTER_MODELS') || getEnvVarOptional('OPENROUTER_MODEL') || config.llm.model;
    const models = modelsValue
      ? modelsValue
          .split(',')
          .map((modelName: string) => modelName.trim())
          .filter(Boolean)
      : [];
    if (models.length === 0) {
      throw new Error('Missing OpenRouter model. Set OPENROUTER_MODEL or OPENROUTER_MODELS.');
    }
    const referer = getEnvVarOptional('OPENROUTER_REFERER');
    const title = getEnvVarOptional('OPENROUTER_TITLE') || 'DockBrain';
    logger.info({ modelCount: models.length }, 'Using OpenRouter LLM provider');
    return new OpenRouterProvider(logger, apiKey, models, referer, title);
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}

async function ensureDirectoriesExist(dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

main();
