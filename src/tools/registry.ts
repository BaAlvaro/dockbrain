import type { BaseTool } from './base-tool.js';
import type { ToolDescriptor } from '../types/tool.js';
import type { Logger } from '../utils/logger.js';
import type { ReminderRepository } from '../persistence/repositories/reminder-repository.js';
import type { AppConfig } from '../../config/schema.js';
import type { ConfigStoreRepository } from '../persistence/repositories/config-store-repository.js';
import { FilesReadonlyTool } from './files-readonly/tool.js';
import { RemindersTool } from './reminders/tool.js';
import { WebSandboxTool } from './web-sandbox/tool.js';
import { SystemInfoTool } from './system-info/tool.js';
import { EmailTool } from './email/tool.js';
import { GmailTool } from './gmail/tool.js';
import { NetworkToolsTool } from './network-tools/tool.js';
import { CodexAuthTool } from './codex-auth/tool.js';
import { SystemExecTool } from './system-exec/tool.js';
import { BrowserTool } from './browser/tool.js';
import { FilesWriteTool } from './files-write/tool.js';
import { MemoryTool } from './memory/tool.js';
import { SessionsTool } from './sessions/tool.js';
import type { LLMProvider } from '../core/agent/llm-provider.js';
import { UserMemoryManager } from '../core/memory/user-memory.js';
import { MemoryManager } from '../core/memory/memory-manager.js';
import { SessionManager } from '../core/orchestrator/session-manager.js';
import { MessageRouter } from '../core/orchestrator/message-router.js';

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  constructor(
    private logger: Logger,
    reminderRepo: ReminderRepository,
    config: AppConfig,
    safeRootDir: string,
    configStore?: ConfigStoreRepository,
    llmProvider?: LLMProvider
  ) {
    if (config.tools.files_readonly.enabled) {
      this.register(
        new FilesReadonlyTool(
          logger,
          safeRootDir,
          config.tools.files_readonly.max_file_size_mb,
          config.tools.files_readonly.allowed_extensions
        )
      );
    }

    if (config.tools.files_write.enabled) {
      this.register(
        new FilesWriteTool(
          logger,
          safeRootDir,
          config.tools.files_write.max_file_size_mb,
          config.tools.files_write.backup_enabled,
          config.tools.files_write.backup_dir_name
        )
      );
    }

    if (config.tools.reminders.enabled) {
      this.register(
        new RemindersTool(
          logger,
          reminderRepo,
          config.tools.reminders.max_reminders_per_user
        )
      );
    }

    if (config.tools.web_sandbox.enabled) {
      this.register(
        new WebSandboxTool(
          logger,
          config.security.web_allowed_domains,
          config.tools.web_sandbox.timeout_ms,
          config.tools.web_sandbox.max_response_size_mb
        )
      );
    }

    if (config.tools.system_info.enabled) {
      this.register(new SystemInfoTool(logger));
    }

    if (config.tools.email.enabled) {
      this.register(new EmailTool(logger));
    }

    if (config.tools.gmail.enabled || configStore?.get('gmail.refresh_token') || process.env.GMAIL_REFRESH_TOKEN) {
      this.register(new GmailTool(logger, configStore));
    }

    if (config.tools.network_tools.enabled) {
      this.register(
        new NetworkToolsTool(
          logger,
          config.tools.network_tools.allowed_ssh_hosts,
          config.tools.network_tools.ssh_timeout_ms
        )
      );
    }

    if (config.tools.browser.enabled) {
      this.register(
        new BrowserTool(
          logger,
          config.tools.browser.allowed_domains,
          config.tools.browser.max_timeout_ms,
          config.tools.browser.screenshot_dir
        )
      );
    }

    if (config.tools.memory.enabled) {
      const userMemory = new UserMemoryManager(logger, config.tools.memory.data_dir);
      const memoryManager = new MemoryManager(logger, userMemory, {
        include_in_prompt: config.tools.memory.include_in_prompt,
        max_entries: config.tools.memory.max_entries,
        auto_append_user: config.tools.memory.auto_append_user,
        auto_append_assistant: config.tools.memory.auto_append_assistant,
      });
      this.register(new MemoryTool(logger, memoryManager));
    }

    if (config.tools.sessions.enabled && llmProvider) {
      const sessionManager = new SessionManager(
        logger,
        llmProvider,
        config.llm.temperature,
        config.llm.max_tokens,
        config.tools.sessions.data_dir
      );
      const messageRouter = new MessageRouter(logger, sessionManager);
      this.register(new SessionsTool(logger, sessionManager, messageRouter));
    }

    if (config.tools.codex_auth.enabled) {
      const cliPath = config.tools.codex_auth.cli_path || process.env.CODEX_CLI_PATH || 'codex';
      const codexHome = config.tools.codex_auth.codex_home || process.env.CODEX_HOME;
      this.register(
        new CodexAuthTool(
          logger,
          cliPath,
          codexHome,
          config.tools.codex_auth.login_timeout_ms
        )
      );
    }

    if (config.tools.system_exec.enabled) {
      this.register(
        new SystemExecTool(
          logger,
          config.tools.system_exec.allowed_commands,
          config.tools.system_exec.blocked_commands,
          config.tools.system_exec.allowed_systemctl_actions,
          config.tools.system_exec.allowed_systemctl_units,
          config.tools.system_exec.allowed_ufw_actions,
          config.tools.system_exec.max_output_bytes,
          config.tools.system_exec.default_timeout_ms,
          config.tools.system_exec.allowed_working_dirs
        )
      );
    }

    this.logger.info(
      { tools: Array.from(this.tools.keys()) },
      'Tool registry initialized'
    );
  }

  private register(tool: BaseTool): void {
    this.tools.set(tool.getName(), tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getDescriptor(name: string): ToolDescriptor | undefined {
    const tool = this.tools.get(name);
    return tool?.getDescriptor();
  }

  getAllDescriptors(): ToolDescriptor[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDescriptor());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
