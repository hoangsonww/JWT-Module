import {
  logAuditEvent,
  getAuditEvents,
  getUserAuditEvents,
  getAuditEventCount,
  clearAuditLog,
} from "../auth/audit-log";

beforeEach(() => clearAuditLog());

describe("audit-log", () => {
  test("logs an event and retrieves it", () => {
    logAuditEvent("REGISTER", { userId: "u1", email: "a@b.com" });
    const events = getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("REGISTER");
    expect(events[0].userId).toBe("u1");
    expect(events[0].email).toBe("a@b.com");
  });

  test("assigns a unique id and timestamp to each event", () => {
    logAuditEvent("LOGIN_SUCCESS", { userId: "u1" });
    logAuditEvent("LOGIN_SUCCESS", { userId: "u1" });
    const events = getAuditEvents();
    expect(events[0].id).toBeDefined();
    expect(events[1].id).toBeDefined();
    expect(events[0].id).not.toBe(events[1].id);
    expect(events[0].timestamp).toBeInstanceOf(Date);
  });

  test("returns events in reverse chronological order", () => {
    logAuditEvent("LOGIN_SUCCESS", { userId: "u1" });
    logAuditEvent("LOGOUT", { userId: "u1" });
    const events = getAuditEvents();
    expect(events[0].type).toBe("LOGOUT");
    expect(events[1].type).toBe("LOGIN_SUCCESS");
  });

  test("respects limit parameter", () => {
    for (let i = 0; i < 10; i++) logAuditEvent("LOGIN_SUCCESS", { userId: "u1" });
    expect(getAuditEvents(5)).toHaveLength(5);
    expect(getAuditEvents(10)).toHaveLength(10);
  });

  test("filters events by userId", () => {
    logAuditEvent("REGISTER", { userId: "u1", email: "a@b.com" });
    logAuditEvent("REGISTER", { userId: "u2", email: "b@b.com" });
    logAuditEvent("LOGIN_SUCCESS", { userId: "u1" });
    const u1Events = getUserAuditEvents("u1");
    expect(u1Events).toHaveLength(2);
    expect(u1Events.every((e) => e.userId === "u1")).toBe(true);
  });

  test("getUserAuditEvents returns empty array for unknown userId", () => {
    logAuditEvent("REGISTER", { userId: "u1" });
    expect(getUserAuditEvents("nobody")).toHaveLength(0);
  });

  test("null fields when context is omitted", () => {
    logAuditEvent("LOGIN_FAILURE");
    const [event] = getAuditEvents(1);
    expect(event.userId).toBeNull();
    expect(event.ip).toBeNull();
    expect(event.userAgent).toBeNull();
    expect(event.email).toBeNull();
  });

  test("stores ip and userAgent from context", () => {
    logAuditEvent("LOGIN_SUCCESS", {
      userId: "u1",
      ip: "1.2.3.4",
      userAgent: "TestAgent/1.0",
    });
    const [event] = getAuditEvents(1);
    expect(event.ip).toBe("1.2.3.4");
    expect(event.userAgent).toBe("TestAgent/1.0");
  });

  test("stores meta from context", () => {
    logAuditEvent("EMAIL_CHANGE", { userId: "u1", meta: { newEmail: "new@b.com" } });
    const [event] = getAuditEvents(1);
    expect(event.meta).toEqual({ newEmail: "new@b.com" });
  });

  test("events without meta have no meta field", () => {
    logAuditEvent("LOGOUT", { userId: "u1" });
    const [event] = getAuditEvents(1);
    expect(event.meta).toBeUndefined();
  });

  test("getAuditEventCount returns correct total", () => {
    logAuditEvent("REGISTER", { userId: "u1" });
    logAuditEvent("REGISTER", { userId: "u2" });
    expect(getAuditEventCount()).toBe(2);
  });

  test("clearAuditLog empties the log", () => {
    logAuditEvent("REGISTER", { userId: "u1" });
    clearAuditLog();
    expect(getAuditEvents()).toHaveLength(0);
    expect(getAuditEventCount()).toBe(0);
  });
});
