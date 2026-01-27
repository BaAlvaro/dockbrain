import { Bot, Context } from 'grammy';
import type { Logger } from '../../utils/logger.js';
import type { Gateway } from '../../core/gateway/gateway.js';
import type { PairingManager } from '../../core/security/pairing-manager.js';
import type { PermissionManager } from '../../core/security/permission-manager.js';
import type { UserRepository } from '../../persistence/repositories/user-repository.js';
import type { IncomingMessage } from '../../types/message.js';

export class TelegramConnector {
  private bot: Bot;

  constructor(
    private logger: Logger,
    private gateway: Gateway,
    private pairingManager: PairingManager,
    private permissionManager: PermissionManager,
    private userRepo: UserRepository,
    botToken: string
  ) {
    this.bot = new Bot(botToken);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.command('start', async (ctx) => {
      await this.handleStart(ctx);
    });

    this.bot.command('pair', async (ctx) => {
      await this.handlePair(ctx);
    });

    this.bot.command('help', async (ctx) => {
      await this.handleHelp(ctx);
    });

    this.bot.command('status', async (ctx) => {
      await this.handleStatus(ctx);
    });

    this.bot.on('message:text', async (ctx) => {
      await this.handleMessage(ctx);
    });

    this.bot.catch((err) => {
      this.logger.error({ error: err }, 'Telegram bot error');
    });
  }

  private async handleStart(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    const args = ctx.message?.text?.split(' ').slice(1);
    const token = args?.[0];

    if (token) {
      await this.handlePairWithToken(ctx, token);
      return;
    }

    await ctx.reply(
      'Welcome to DockBrain!\n\n' +
      'To get started, you need to pair this chat with your DockBrain instance.\n' +
      'Use the command: /pair <token>\n\n' +
      'Get a pairing token from your administrator.'
    );
  }

  private async handlePair(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    const args = ctx.message?.text?.split(' ').slice(1);
    const token = args?.[0];

    if (!token) {
      await ctx.reply('Usage: /pair <token>');
      return;
    }

    await this.handlePairWithToken(ctx, token);
  }

  private async handlePairWithToken(ctx: Context, token: string): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    const displayName = ctx.from?.first_name || 'Unknown User';
    const username = ctx.from?.username;

    const result = await this.pairingManager.pairUser({
      token,
      telegram_chat_id: chatId,
      username,
      display_name: displayName,
    });

    if (!result.success) {
      await ctx.reply(`Pairing failed: ${result.error}`);
      return;
    }

    this.permissionManager.grantDefaultPermissions(result.user_id!);

    await ctx.reply(
      'Successfully paired! 🎉\n\n' +
      'You now have access to basic commands.\n' +
      'Type /help to see what you can do.'
    );

    this.logger.info({ userId: result.user_id, chatId }, 'User paired successfully via Telegram');
  }

  private async handleHelp(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    if (!this.pairingManager.isUserPaired(chatId)) {
      await ctx.reply('You need to pair first. Use /pair <token>');
      return;
    }

    await ctx.reply(
      'DockBrain Commands:\n\n' +
      '/help - Show this help message\n' +
      '/status - Check your pairing status\n\n' +
      'You can also send me natural language requests, like:\n' +
      '- "Remind me tomorrow at 10am to call John"\n' +
      '- "List my reminders"\n' +
      '- "Show system information"'
    );
  }

  private async handleStatus(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    const user = this.userRepo.findByTelegramChatId(chatId);

    if (!user) {
      await ctx.reply('Not paired. Use /pair <token> to pair your account.');
      return;
    }

    const permissions = await this.permissionManager.hasPermission(user.id, 'reminders', 'create');

    await ctx.reply(
      `Status: ${user.is_active ? 'Active ✅' : 'Inactive ❌'}\n` +
      `Rate limit: ${user.rate_limit_per_minute} messages/minute\n` +
      `Paired since: ${new Date(user.paired_at).toLocaleString()}`
    );
  }

  private async handleMessage(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    const messageId = ctx.message?.message_id;
    const text = ctx.message?.text;

    if (!chatId || !messageId || !text) return;

    if (text.startsWith('/')) {
      return;
    }

    if (!this.pairingManager.isUserPaired(chatId)) {
      await ctx.reply('You need to pair first. Use /pair <token>');
      return;
    }

    const message: IncomingMessage = {
      message_id: messageId,
      chat_id: chatId,
      text,
      user_display_name: ctx.from?.first_name || 'Unknown',
      username: ctx.from?.username,
      timestamp: Date.now(),
    };

    await this.gateway.processMessage(message);
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, text);
    } catch (error: any) {
      this.logger.error({ error, chatId }, 'Failed to send Telegram message');
    }
  }

  async start(): Promise<void> {
    this.logger.info('Starting Telegram bot');
    await this.bot.start();
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Telegram bot');
    await this.bot.stop();
  }
}
