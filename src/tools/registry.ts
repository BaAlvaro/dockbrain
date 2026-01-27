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

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  constructor(
    private logger: Logger,
    reminderRepo: ReminderRepository,
    config: AppConfig,
    safeRootDir: string,
    configStore?: ConfigStoreRepository
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
