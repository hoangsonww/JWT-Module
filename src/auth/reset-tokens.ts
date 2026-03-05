import { createId } from "@paralleldrive/cuid2";
import { AuthError } from "./errors";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

interface ResetTokenEntry {
  userId: string;
  email: string;
  expiresAt: number;
}

const resetTokens = new Map<string, ResetTokenEntry>();

export function createResetToken(userId: string, email: string): string {
  // Revoke any existing reset token for this user first
  for (const [token, entry] of resetTokens) {
    if (entry.userId === userId) {
      resetTokens.delete(token);
    }
  }
  const token = createId();
  resetTokens.set(token, { userId, email, expiresAt: Date.now() + RESET_TOKEN_TTL_MS });
  return token;
}

export function consumeResetToken(token: string): { userId: string; email: string } {
  const entry = resetTokens.get(token);
  if (!entry || Date.now() > entry.expiresAt) {
    throw new AuthError("INVALID_TOKEN", "Password reset token is invalid or expired");
  }
  resetTokens.delete(token);
  return { userId: entry.userId, email: entry.email };
}

export function pruneExpiredResetTokens(): void {
  const now = Date.now();
  for (const [token, entry] of resetTokens) {
    if (now > entry.expiresAt) resetTokens.delete(token);
  }
}

export function getResetTokenCount(): number {
  return resetTokens.size;
}

export function clearResetTokens(): void {
  resetTokens.clear();
}
