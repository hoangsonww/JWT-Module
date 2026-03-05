import { createId } from "@paralleldrive/cuid2";
import { AuthError } from "./errors";

export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  createdAt: Date;
  lastUsedAt: Date;
  ip: string | null;
  userAgent: string | null;
}

export interface PublicSession {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  ip: string | null;
  userAgent: string | null;
}

const sessions = new Map<string, Session>();
const userSessionIndex = new Map<string, Set<string>>();

function toPublic({ id, createdAt, lastUsedAt, ip, userAgent }: Session): PublicSession {
  return { id, createdAt, lastUsedAt, ip, userAgent };
}

export function createSession(
  userId: string,
  refreshToken: string,
  ip: string | null,
  userAgent: string | null,
): Session {
  const session: Session = {
    id: createId(),
    userId,
    refreshToken,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    ip,
    userAgent,
  };
  sessions.set(session.id, session);
  if (!userSessionIndex.has(userId)) userSessionIndex.set(userId, new Set());
  userSessionIndex.get(userId)!.add(session.id);
  return session;
}

export function getSessionByToken(refreshToken: string): Session | undefined {
  for (const session of sessions.values()) {
    if (session.refreshToken === refreshToken) return session;
  }
  return undefined;
}

export function touchSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) session.lastUsedAt = new Date();
}

export function rotateSessionToken(sessionId: string, newRefreshToken: string): void {
  const session = sessions.get(sessionId);
  if (session) session.refreshToken = newRefreshToken;
}

export function revokeSessionById(sessionId: string, requestingUserId: string): void {
  const session = sessions.get(sessionId);
  if (!session) throw new AuthError("SESSION_NOT_FOUND", "Session not found");
  if (session.userId !== requestingUserId) {
    throw new AuthError("FORBIDDEN", "You do not have permission to revoke this session");
  }
  sessions.delete(sessionId);
  userSessionIndex.get(session.userId)?.delete(sessionId);
}

export function revokeSessionByToken(refreshToken: string): void {
  const session = getSessionByToken(refreshToken);
  if (!session) return;
  sessions.delete(session.id);
  userSessionIndex.get(session.userId)?.delete(session.id);
}

export function revokeAllUserSessions(userId: string): void {
  const ids = userSessionIndex.get(userId);
  if (ids) {
    for (const id of ids) sessions.delete(id);
    ids.clear();
  }
}

export function listUserSessions(userId: string): PublicSession[] {
  const ids = userSessionIndex.get(userId) ?? new Set<string>();
  return Array.from(ids)
    .map((id) => sessions.get(id))
    .filter((s): s is Session => s !== undefined)
    .sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime())
    .map(toPublic);
}

export function getSessionCount(): number {
  return sessions.size;
}

export function clearSessions(): void {
  sessions.clear();
  userSessionIndex.clear();
}
