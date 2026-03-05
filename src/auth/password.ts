import bcrypt from "bcrypt";
import { AuthError } from "./errors";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordStrength(password: string): void {
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AuthError(
      "WEAK_PASSWORD",
      "Password must be at least 8 characters and contain at least one letter and one number",
    );
  }
}
