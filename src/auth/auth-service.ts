import { createId } from "@paralleldrive/cuid2";
import { AuthError } from "./errors";
import { hashPassword, validatePasswordStrength, verifyPassword } from "./password";
import { generateTokens, revokeRefreshToken, verifyRefreshToken } from "./token";
import type { AuthTokens, LoginInput, RegisterInput, User } from "./types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const users = new Map<string, User>();

const userTokens = new Map<string, Set<string>>();

interface LockoutEntry {
  count: number;
  lockedUntil: number | null;
}
const loginAttempts = new Map<string, LockoutEntry>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function findByEmail(email: string): User | undefined {
  for (const user of users.values()) {
    if (user.email === email) {
      return user;
    }
  }
  return undefined;
}

function registerRefreshToken(userId: string, token: string): void {
  if (!userTokens.has(userId)) userTokens.set(userId, new Set());
  userTokens.get(userId)!.add(token);
}

function revokeAllUserTokens(userId: string): void {
  const tokens = userTokens.get(userId);
  if (tokens) {
    for (const token of tokens) revokeRefreshToken(token);
    tokens.clear();
  }
}

export async function register(input: RegisterInput): Promise<AuthTokens> {
  const email = input.email.toLowerCase().trim();

  if (!EMAIL_REGEX.test(email)) {
    throw new AuthError("INVALID_EMAIL", "Invalid email format");
  }

  if (findByEmail(email)) {
    throw new AuthError("DUPLICATE_EMAIL", "An account with this email already exists");
  }

  validatePasswordStrength(input.password);

  const passwordHash = await hashPassword(input.password);
  const id = createId();

  const user: User = {
    id,
    email,
    passwordHash,
    createdAt: new Date(),
  };

  users.set(id, user);

  const tokens = generateTokens({ userId: id, email });
  registerRefreshToken(id, tokens.refreshToken);
  return tokens;
}

export async function login(input: LoginInput): Promise<AuthTokens> {
  const email = input.email.toLowerCase().trim();

  const lockout = loginAttempts.get(email);
  if (lockout?.lockedUntil && Date.now() < lockout.lockedUntil) {
    throw new AuthError(
      "ACCOUNT_LOCKED",
      "Account temporarily locked due to too many failed attempts. Try again later.",
    );
  }

  const user = findByEmail(email);

  if (!user) {
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    const entry = loginAttempts.get(email) ?? { count: 0, lockedUntil: null };
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
      entry.lockedUntil = Date.now() + LOCKOUT_MS;
    }
    loginAttempts.set(email, entry);
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  loginAttempts.delete(email);

  const tokens = generateTokens({ userId: user.id, email: user.email });
  registerRefreshToken(user.id, tokens.refreshToken);
  return tokens;
}

export function refreshTokens(refreshToken: string): AuthTokens {
  const payload = verifyRefreshToken(refreshToken);

  const user = users.get(payload.userId);
  if (!user) {
    throw new AuthError("USER_NOT_FOUND", "User not found for token");
  }

  revokeRefreshToken(refreshToken);
  userTokens.get(payload.userId)?.delete(refreshToken);

  const tokens = generateTokens({ userId: user.id, email: user.email });
  registerRefreshToken(user.id, tokens.refreshToken);
  return tokens;
}

export function getUserById(id: string): User | undefined {
  return users.get(id);
}

export function logout(refreshToken: string): void {
  try {
    const payload = verifyRefreshToken(refreshToken);
    userTokens.get(payload.userId)?.delete(refreshToken);
  } catch {
    // token may already be expired/invalid — still revoke it
  }
  revokeRefreshToken(refreshToken);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = users.get(userId);
  if (!user) {
    throw new AuthError("USER_NOT_FOUND", "User not found");
  }
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AuthError("INVALID_CREDENTIALS", "Current password is incorrect");
  }
  validatePasswordStrength(newPassword);
  user.passwordHash = await hashPassword(newPassword);
  revokeAllUserTokens(userId);
}

export function logoutAll(userId: string): void {
  revokeAllUserTokens(userId);
}

export async function updateEmail(
  userId: string,
  newEmail: string,
  password: string,
): Promise<void> {
  const user = users.get(userId);
  if (!user) throw new AuthError("USER_NOT_FOUND", "User not found");
  const email = newEmail.toLowerCase().trim();
  if (!EMAIL_REGEX.test(email)) throw new AuthError("INVALID_EMAIL", "Invalid email format");
  if (findByEmail(email))
    throw new AuthError("DUPLICATE_EMAIL", "An account with this email already exists");
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AuthError("INVALID_CREDENTIALS", "Password is incorrect");
  user.email = email;
}

export async function deleteAccount(userId: string, password: string): Promise<void> {
  const user = users.get(userId);
  if (!user) throw new AuthError("USER_NOT_FOUND", "User not found");
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AuthError("INVALID_CREDENTIALS", "Password is incorrect");
  revokeAllUserTokens(userId);
  userTokens.delete(userId);
  users.delete(userId);
}

export function clearLoginAttempts(): void {
  loginAttempts.clear();
}

export function clearUserTokens(): void {
  userTokens.clear();
}
