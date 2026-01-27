import { createHash, randomBytes } from 'crypto';
import { nanoid } from 'nanoid';

export function generateToken(length: number = 24): string {
  return nanoid(length);
}

export function generateSecureToken(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateTaskId(): string {
  return `task_${nanoid(16)}`;
}

export function generateReminderId(): string {
  return `reminder_${nanoid(16)}`;
}
