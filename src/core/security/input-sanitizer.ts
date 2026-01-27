import type { Logger } from '../../utils/logger.js';

export class InputSanitizer {
  private static readonly DANGEROUS_PATTERNS = [
    /\x00/g, // Null bytes
    /<script\b[^>]*>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers
  ];

  constructor(private logger: Logger) {}

  sanitizeText(input: string, maxLength: number = 10000): string {
    if (input.length > maxLength) {
      this.logger.warn({ inputLength: input.length, maxLength }, 'Input truncated');
      input = input.substring(0, maxLength);
    }

    let sanitized = input;

    for (const pattern of InputSanitizer.DANGEROUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        this.logger.warn({ pattern: pattern.source }, 'Dangerous pattern detected in input');
        sanitized = sanitized.replace(pattern, '');
      }
    }

    return sanitized.trim();
  }

  sanitizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        this.logger.warn({ url, protocol: parsed.protocol }, 'Invalid URL protocol');
        return null;
      }

      return parsed.toString();
    } catch {
      this.logger.warn({ url }, 'Invalid URL format');
      return null;
    }
  }

  isPrivateIp(hostname: string): boolean {
    const privateRanges = [
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/,
    ];

    return privateRanges.some((pattern) => pattern.test(hostname));
  }

  validateDomain(hostname: string, allowedDomains: string[]): boolean {
    const isAllowed = allowedDomains.some((domain) => {
      return hostname === domain || hostname.endsWith(`.${domain}`);
    });

    if (!isAllowed) {
      this.logger.warn({ hostname, allowedDomains }, 'Domain not in allowlist');
    }

    return isAllowed;
  }
}
