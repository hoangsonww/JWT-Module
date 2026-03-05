import { createId } from "@paralleldrive/cuid2";

export type AuditEventType =
  | "REGISTER"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "LOGOUT_ALL"
  | "TOKEN_REFRESH"
  | "PASSWORD_CHANGE"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET"
  | "EMAIL_CHANGE"
  | "ACCOUNT_DELETED"
  | "ACCOUNT_LOCKED"
  | "SESSION_REVOKED";

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  userId: string | null;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  timestamp: Date;
  meta?: Record<string, unknown>;
}

export interface AuditContext {
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}

const MAX_EVENTS = 10_000;
const auditLog: AuditEvent[] = [];

export function logAuditEvent(type: AuditEventType, ctx: AuditContext = {}): void {
  const entry: AuditEvent = {
    id: createId(),
    type,
    userId: ctx.userId ?? null,
    email: ctx.email ?? null,
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
    timestamp: new Date(),
    ...(ctx.meta ? { meta: ctx.meta } : {}),
  };
  auditLog.push(entry);
  if (auditLog.length > MAX_EVENTS) auditLog.shift();
}

export function getAuditEvents(limit = 100): AuditEvent[] {
  const start = Math.max(0, auditLog.length - limit);
  return auditLog.slice(start).reverse();
}

export function getUserAuditEvents(userId: string, limit = 50): AuditEvent[] {
  const userEvents = auditLog.filter((e) => e.userId === userId);
  const start = Math.max(0, userEvents.length - limit);
  return userEvents.slice(start).reverse();
}

export function getAuditEventCount(): number {
  return auditLog.length;
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}
