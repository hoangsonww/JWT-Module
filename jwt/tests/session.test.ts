import {
  createSession,
  revokeSessionById,
  revokeSessionByToken,
  revokeAllUserSessions,
  listUserSessions,
  getSessionCount,
  clearSessions,
  touchSession,
  rotateSessionToken,
  getSessionByToken,
} from "../auth/session";
import { AuthError } from "../auth/errors";

beforeEach(() => clearSessions());

describe("session - creation", () => {
  test("creates a session with correct fields", () => {
    const s = createSession("u1", "tok123", "1.2.3.4", "Mozilla/5.0");
    expect(s.id).toBeDefined();
    expect(s.userId).toBe("u1");
    expect(s.refreshToken).toBe("tok123");
    expect(s.ip).toBe("1.2.3.4");
    expect(s.userAgent).toBe("Mozilla/5.0");
    expect(s.createdAt).toBeInstanceOf(Date);
    expect(s.lastUsedAt).toBeInstanceOf(Date);
  });

  test("accepts null for ip and userAgent", () => {
    const s = createSession("u1", "tok1", null, null);
    expect(s.ip).toBeNull();
    expect(s.userAgent).toBeNull();
  });

  test("getSessionByToken retrieves session by refresh token", () => {
    const s = createSession("u1", "tok123", null, null);
    expect(getSessionByToken("tok123")).toBe(s);
  });

  test("getSessionByToken returns undefined for unknown token", () => {
    expect(getSessionByToken("no-such-token")).toBeUndefined();
  });
});

describe("session - listing", () => {
  test("listUserSessions returns public sessions for a user", () => {
    createSession("u1", "tok1", null, null);
    createSession("u1", "tok2", null, null);
    const sessions = listUserSessions("u1");
    expect(sessions).toHaveLength(2);
    // public sessions must not expose refreshToken
    for (const s of sessions) {
      expect(s).not.toHaveProperty("refreshToken");
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("createdAt");
      expect(s).toHaveProperty("lastUsedAt");
    }
  });

  test("listUserSessions returns empty array for unknown user", () => {
    expect(listUserSessions("nobody")).toHaveLength(0);
  });

  test("listUserSessions does not include other users sessions", () => {
    createSession("u1", "tok1", null, null);
    createSession("u2", "tok2", null, null);
    expect(listUserSessions("u1")).toHaveLength(1);
    expect(listUserSessions("u2")).toHaveLength(1);
  });
});

describe("session - touch and rotate", () => {
  test("touchSession updates lastUsedAt", () => {
    const s = createSession("u1", "tok1", null, null);
    const before = s.lastUsedAt.getTime();
    touchSession(s.id);
    const listed = listUserSessions("u1");
    expect(listed[0].lastUsedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  test("touchSession on unknown id is a no-op", () => {
    expect(() => touchSession("nonexistent")).not.toThrow();
  });

  test("rotateSessionToken changes the refresh token", () => {
    const s = createSession("u1", "old-token", null, null);
    rotateSessionToken(s.id, "new-token");
    expect(getSessionByToken("old-token")).toBeUndefined();
    expect(getSessionByToken("new-token")).toBeDefined();
  });

  test("rotateSessionToken on unknown id is a no-op", () => {
    expect(() => rotateSessionToken("nonexistent", "anything")).not.toThrow();
  });
});

describe("session - revocation", () => {
  test("revokeSessionById removes the session", () => {
    const s = createSession("u1", "tok1", null, null);
    revokeSessionById(s.id, "u1");
    expect(getSessionCount()).toBe(0);
    expect(listUserSessions("u1")).toHaveLength(0);
  });

  test("revokeSessionById throws SESSION_NOT_FOUND for unknown id", () => {
    expect(() => revokeSessionById("nonexistent", "u1")).toThrow(AuthError);
    try {
      revokeSessionById("nonexistent", "u1");
    } catch (e) {
      expect((e as AuthError).code).toBe("SESSION_NOT_FOUND");
    }
  });

  test("revokeSessionById throws FORBIDDEN when userId does not match", () => {
    const s = createSession("u1", "tok1", null, null);
    expect(() => revokeSessionById(s.id, "u2")).toThrow(AuthError);
    try {
      revokeSessionById(s.id, "u2");
    } catch (e) {
      expect((e as AuthError).code).toBe("FORBIDDEN");
    }
  });

  test("revokeSessionByToken removes session by token", () => {
    createSession("u1", "tok1", null, null);
    revokeSessionByToken("tok1");
    expect(getSessionCount()).toBe(0);
  });

  test("revokeSessionByToken is a no-op for unknown token", () => {
    expect(() => revokeSessionByToken("no-such-token")).not.toThrow();
  });

  test("revokeAllUserSessions removes all sessions for a user", () => {
    createSession("u1", "t1", null, null);
    createSession("u1", "t2", null, null);
    createSession("u2", "t3", null, null);
    revokeAllUserSessions("u1");
    expect(listUserSessions("u1")).toHaveLength(0);
    expect(listUserSessions("u2")).toHaveLength(1);
    expect(getSessionCount()).toBe(1);
  });

  test("revokeAllUserSessions is a no-op for unknown user", () => {
    createSession("u1", "t1", null, null);
    revokeAllUserSessions("nobody");
    expect(getSessionCount()).toBe(1);
  });
});

describe("session - counts", () => {
  test("getSessionCount returns total across all users", () => {
    createSession("u1", "t1", null, null);
    createSession("u2", "t2", null, null);
    expect(getSessionCount()).toBe(2);
  });

  test("getSessionCount returns 0 when empty", () => {
    expect(getSessionCount()).toBe(0);
  });

  test("clearSessions empties all sessions", () => {
    createSession("u1", "t1", null, null);
    createSession("u2", "t2", null, null);
    clearSessions();
    expect(getSessionCount()).toBe(0);
    expect(listUserSessions("u1")).toHaveLength(0);
  });
});
