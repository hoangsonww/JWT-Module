export { AuthError } from "./errors";
export type { AuthErrorCode } from "./errors";
export {
  logAuditEvent,
  getAuditEvents,
  getUserAuditEvents,
  getAuditEventCount,
  clearAuditLog,
} from "./audit-log";
export type { AuditEvent, AuditEventType, AuditContext } from "./audit-log";
export { authEvents } from "./events";
export type { AuthEventMap } from "./events";
export { hashPassword, validatePasswordStrength, verifyPassword } from "./password";
export { clearResetTokens, pruneExpiredResetTokens, getResetTokenCount } from "./reset-tokens";
export {
  createSession,
  revokeSessionById,
  revokeSessionByToken,
  revokeAllUserSessions,
  listUserSessions,
  getSessionCount,
  clearSessions,
} from "./session";
export type { Session, PublicSession } from "./session";
export {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  clearRevokedTokens,
  pruneExpiredTokens,
  revokeRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./token";
export {
  changePassword,
  clearLoginAttempts,
  clearUserTokens,
  deleteAccount,
  getUserById,
  getUserCount,
  listUsers,
  login,
  logout,
  logoutAll,
  refreshTokens,
  register,
  requestPasswordReset,
  resetPassword,
  updateEmail,
} from "./auth-service";
export type {
  AuthTokens,
  LoginInput,
  RegisterInput,
  TokenPayload,
  User,
  UserPublic,
} from "./types";
