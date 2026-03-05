export type AuthErrorCode =
  | "DUPLICATE_EMAIL"
  | "INVALID_CREDENTIALS"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "MISSING_SECRET"
  | "INVALID_EMAIL"
  | "WEAK_PASSWORD"
  | "MISSING_TOKEN"
  | "USER_NOT_FOUND"
  | "ACCOUNT_LOCKED"
  | "SESSION_NOT_FOUND"
  | "FORBIDDEN";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}
