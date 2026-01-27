import { google } from 'googleapis';
import type { ConfigStoreRepository } from '../../persistence/repositories/config-store-repository.js';

export type GmailSendInput = {
  to: string;
  subject: string;
  body: string;
  from?: string;
};

export class GmailService {
  private authClient: any | null = null;

  constructor(private configStore?: ConfigStoreRepository) {}

  private getAuth() {
    if (this.authClient) {
      return this.authClient;
    }

    const clientId =
      this.configStore?.get('gmail.client_id') || process.env.GMAIL_CLIENT_ID;
    const clientSecret =
      this.configStore?.get('gmail.client_secret') || process.env.GMAIL_CLIENT_SECRET;
    const redirectUri =
      this.configStore?.get('gmail.redirect_uri') ||
      process.env.GMAIL_REDIRECT_URI ||
      'http://localhost:3000/oauth2callback';
    const refreshToken =
      this.configStore?.get('gmail.refresh_token') || process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Gmail OAuth is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.'
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    this.authClient = oauth2Client;
    return oauth2Client;
  }

  async send(input: GmailSendInput): Promise<{ message_id?: string }> {
    const auth = this.getAuth();
    const gmail = google.gmail({ version: 'v1', auth });
    const from =
      input.from || this.configStore?.get('gmail.from') || process.env.GMAIL_FROM;

    const headers = [
      from ? `From: ${from}` : undefined,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
    ].filter(Boolean);

    const message = `${headers.join('\r\n')}\r\n\r\n${input.body}`;
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return { message_id: result.data.id };
  }
}
