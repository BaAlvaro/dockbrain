import type { PairingTokenRepository } from '../../persistence/repositories/pairing-token-repository.js';
import type { UserRepository } from '../../persistence/repositories/user-repository.js';
import type { PairingRequest } from '../../types/user.js';
import type { Logger } from '../../utils/logger.js';
import { generateToken } from '../../utils/crypto.js';

export interface CreateTokenResult {
  token: string;
  expires_at: number;
}

export class PairingManager {
  constructor(
    private pairingTokenRepo: PairingTokenRepository,
    private userRepo: UserRepository,
    private logger: Logger,
    private defaultTtlMinutes: number
  ) {}

  createPairingToken(ttlMinutes?: number, isAdmin?: boolean): CreateTokenResult {
    const token = generateToken(24);
    const ttl = ttlMinutes || this.defaultTtlMinutes;

    const pairingToken = this.pairingTokenRepo.create({
      token,
      ttl_minutes: ttl,
      is_admin: isAdmin || false,
    });

    this.logger.info({ token: token.substring(0, 6) + '...', ttl, isAdmin }, 'Created pairing token');

    return {
      token: pairingToken.token,
      expires_at: pairingToken.expires_at,
    };
  }

  async pairUser(request: PairingRequest): Promise<{ success: boolean; user_id?: number; is_admin?: boolean; error?: string }> {
    if (!this.pairingTokenRepo.isValid(request.token)) {
      this.logger.warn({ token: request.token.substring(0, 6) + '...' }, 'Invalid or expired pairing token');
      return { success: false, error: 'Invalid or expired pairing token' };
    }

    const pairingToken = this.pairingTokenRepo.findByToken(request.token);
    const isAdmin = Boolean(pairingToken?.is_admin);

    const existingUser = this.userRepo.findByTelegramChatId(request.telegram_chat_id);
    if (existingUser) {
      this.logger.warn({ chatId: request.telegram_chat_id }, 'User already paired');
      return { success: false, error: 'User already paired' };
    }

    const user = this.userRepo.create({
      telegram_chat_id: request.telegram_chat_id,
      username: request.username,
      display_name: request.display_name,
    });

    this.pairingTokenRepo.markUsed(request.token, request.telegram_chat_id);

    this.logger.info({ userId: user.id, chatId: request.telegram_chat_id }, 'User paired successfully');

    return { success: true, user_id: user.id, is_admin: isAdmin };
  }

  isUserPaired(telegramChatId: string): boolean {
    const user = this.userRepo.findByTelegramChatId(telegramChatId);
    return user !== null && user.is_active;
  }

  cleanExpiredTokens(): number {
    const count = this.pairingTokenRepo.cleanExpired();
    if (count > 0) {
      this.logger.info({ count }, 'Cleaned expired pairing tokens');
    }
    return count;
  }
}
