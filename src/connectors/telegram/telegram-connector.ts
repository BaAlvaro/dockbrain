import { Bot, Context } from 'grammy';
import type { Logger } from '../../utils/logger.js';
import type { Gateway } from '../../core/gateway/gateway.js';
import type { PairingManager } from '../../core/security/pairing-manager.js';
import type { PermissionManager } from '../../core/security/permission-manager.js';
import type { UserRepository } from '../../persistence/repositories/user-repository.js';
import type { IncomingMessage } from '../../types/message.js';
import type { ConfigStoreRepository } from '../../persistence/repositories/config-store-repository.js';
import { google } from 'googleapis';

export class TelegramConnector {
  private bot: Bot;

  constructor(
    private logger: Logger,
    private gateway: Gateway,
    private pairingManager: PairingManager,
    private permissionManager: PermissionManager,
    private userRepo: UserRepository,
    botToken: string,
    private configStore: ConfigStoreRepository
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

    this.bot.command('gmail_setup', async (ctx) => {
      await this.handleGmailSetup(ctx);
    });

    this.bot.command('gmail_connect', async (ctx) => {
      await this.handleGmailConnect(ctx);
    });

    this.bot.command('gmail_code', async (ctx) => {
      await this.handleGmailCode(ctx);
    });

    this.bot.command('gmail_rule_add', async (ctx) => {
      await this.handleGmailRuleAdd(ctx);
    });

    this.bot.command('gmail_rules', async (ctx) => {
      await this.handleGmailRules(ctx);
    });

    this.bot.command('gmail_rule_clear', async (ctx) => {
      await this.handleGmailRuleClear(ctx);
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

    await ctx.reply(
      `Status: ${user.is_active ? 'Active ✅' : 'Inactive ❌'}\n` +
      `Rate limit: ${user.rate_limit_per_minute} messages/minute\n` +
      `Paired since: ${new Date(user.paired_at).toLocaleString()}`
    );
  }

  private async handleGmailSetup(ctx: Context): Promise<void> {
    const args = ctx.message?.text?.split(' ').slice(1) || [];
    const clientId = args[0];
    const clientSecret = args[1];
    const from = args.slice(2).join(' ') || undefined;

    if (!clientId || !clientSecret) {
      await ctx.reply('Usage: /gmail_setup <client_id> <client_secret> [from_email]');
      return;
    }

    this.configStore.set('gmail.client_id', clientId);
    this.configStore.set('gmail.client_secret', clientSecret);
    this.configStore.set('gmail.redirect_uri', 'http://localhost:3000/oauth2callback');
    if (from) {
      this.configStore.set('gmail.from', from);
    }

    await ctx.reply('Gmail OAuth client saved. Now run /gmail_connect to authorize.');
  }

  private async handleGmailConnect(ctx: Context): Promise<void> {
    const clientId = this.configStore.get('gmail.client_id');
    const clientSecret = this.configStore.get('gmail.client_secret');
    const redirectUri =
      this.configStore.get('gmail.redirect_uri') || 'http://localhost:3000/oauth2callback';

    if (!clientId || !clientSecret) {
      await ctx.reply('Missing client credentials. Use /gmail_setup first.');
      return;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.send'],
      prompt: 'consent',
    });

    await ctx.reply(
      'Open this link to authorize Gmail:\n' +
        authUrl +
        '\n\nAfter approving, paste the code using:\n/gmail_code <code>'
    );
  }

  private async handleGmailCode(ctx: Context): Promise<void> {
    const args = ctx.message?.text?.split(' ').slice(1) || [];
    const code = args[0];
    if (!code) {
      await ctx.reply('Usage: /gmail_code <code>');
      return;
    }

    const clientId = this.configStore.get('gmail.client_id');
    const clientSecret = this.configStore.get('gmail.client_secret');
    const redirectUri =
      this.configStore.get('gmail.redirect_uri') || 'http://localhost:3000/oauth2callback';

    if (!clientId || !clientSecret) {
      await ctx.reply('Missing client credentials. Use /gmail_setup first.');
      return;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    try {
      const { tokens } = await oauth2Client.getToken(code.trim());
      if (!tokens.refresh_token) {
        await ctx.reply('No refresh token returned. Try /gmail_connect again.');
        return;
      }
      this.configStore.set('gmail.refresh_token', tokens.refresh_token);
      this.configStore.set('hooks.enabled', 'true');
      this.configStore.set('hooks.gmail.enabled', 'true');

      await ctx.reply('Gmail connected ✅ You can now send emails via Telegram.');
    } catch (error: any) {
      await ctx.reply(`Gmail auth failed: ${error.message}`);
    }
  }

  private async handleGmailRuleAdd(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const args = text.split(' ').slice(1).join(' ');
    const fromMatch = args.match(/from=([^\s]+)/i);
    const toMatch = args.match(/to=([^\s]+)/i);
    const subjectMatch = args.match(/subject=([^\s]+)/i);

    if (!fromMatch || !toMatch) {
      await ctx.reply('Usage: /gmail_rule_add from=example.com to=you@email.com [subject=keyword]');
      return;
    }

    const rules = this.configStore.getJson('hooks.gmail.rules') || [];
    rules.push({
      name: `rule_${Date.now()}`,
      match: {
        from: fromMatch[1],
        subject_contains: subjectMatch ? subjectMatch[1] : undefined,
      },
      actions: [
        {
          type: 'send_email',
          to: toMatch[1],
          subject_template: 'FWD: {{subject}}',
          body_template: 'From: {{from}}\nSubject: {{subject}}\n\n{{body}}',
        },
      ],
    });

    this.configStore.setJson('hooks.gmail.rules', rules);
    await ctx.reply('Rule added ✅');
  }

  private async handleGmailRules(ctx: Context): Promise<void> {
    const rules = this.configStore.getJson('hooks.gmail.rules') || [];
    if (rules.length === 0) {
      await ctx.reply('No Gmail rules configured.');
      return;
    }

    const lines = rules.map((r: any, i: number) => {
      const from = r.match?.from || '*';
      const subject = r.match?.subject_contains || '*';
      const to = r.actions?.[0]?.to || '?';
      return `${i + 1}. from=${from} subject=${subject} -> to=${to}`;
    });

    await ctx.reply(`Gmail rules:\n${lines.join('\n')}`);
  }

  private async handleGmailRuleClear(ctx: Context): Promise<void> {
    this.configStore.setJson('hooks.gmail.rules', []);
    await ctx.reply('All Gmail rules cleared.');
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
