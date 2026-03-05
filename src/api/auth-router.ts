import { Router, type Request, type Response } from "express";
import { AuthError } from "../auth/errors";
import { logAuditEvent, type AuditContext } from "../auth/audit-log";
import {
  createSession,
  revokeSessionById,
  listUserSessions,
  getSessionByToken,
  rotateSessionToken,
} from "../auth/session";
import { verifyAccessToken } from "../auth/token";
import type { AuthService } from "./app";
import { authenticateToken } from "./middleware";
import { rateLimiter } from "./rate-limiter";
import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
  LogoutSchema,
  ChangePasswordSchema,
  UpdateEmailSchema,
  DeleteAccountSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  zodError,
} from "./validation";

const ERROR_STATUS_MAP: Record<string, number> = {
  DUPLICATE_EMAIL: 409,
  INVALID_CREDENTIALS: 401,
  INVALID_TOKEN: 401,
  TOKEN_EXPIRED: 401,
  MISSING_SECRET: 500,
  INVALID_EMAIL: 400,
  WEAK_PASSWORD: 400,
  USER_NOT_FOUND: 404,
  MISSING_TOKEN: 401,
  ACCOUNT_LOCKED: 423,
  SESSION_NOT_FOUND: 404,
  FORBIDDEN: 403,
};

function handleAuthError(err: unknown, res: Response): void {
  if (err instanceof AuthError) {
    const status = ERROR_STATUS_MAP[err.code] ?? 500;
    res.status(status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
}

function getAuditContext(req: Request): AuditContext {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? null;
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;
  return { ip, userAgent };
}

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.post("/auth/register", rateLimiter, async (req: Request, res: Response) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    const ctx = getAuditContext(req);
    try {
      const tokens = await authService.register({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      const payload = verifyAccessToken(tokens.accessToken);
      createSession(payload.userId, tokens.refreshToken, ctx.ip ?? null, ctx.userAgent ?? null);
      logAuditEvent("REGISTER", { ...ctx, userId: payload.userId, email: parsed.data.email });
      res.status(201).json({ tokens });
    } catch (err) {
      logAuditEvent("LOGIN_FAILURE", { ...ctx, email: parsed.data.email });
      handleAuthError(err, res);
    }
  });

  router.post("/auth/login", rateLimiter, async (req: Request, res: Response) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    const ctx = getAuditContext(req);
    try {
      const tokens = await authService.login({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      const payload = verifyAccessToken(tokens.accessToken);
      createSession(payload.userId, tokens.refreshToken, ctx.ip ?? null, ctx.userAgent ?? null);
      logAuditEvent("LOGIN_SUCCESS", { ...ctx, userId: payload.userId, email: parsed.data.email });
      res.status(200).json({ tokens });
    } catch (err) {
      logAuditEvent("LOGIN_FAILURE", { ...ctx, email: parsed.data.email });
      handleAuthError(err, res);
    }
  });

  router.post("/auth/refresh", rateLimiter, (req: Request, res: Response) => {
    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    const ctx = getAuditContext(req);
    try {
      const oldToken = parsed.data.refreshToken;
      const existingSession = getSessionByToken(oldToken);
      const tokens = authService.refreshTokens(oldToken);
      if (existingSession) {
        rotateSessionToken(existingSession.id, tokens.refreshToken);
      }
      logAuditEvent("TOKEN_REFRESH", { ...ctx });
      res.status(200).json({ tokens });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  router.get("/auth/me", authenticateToken, (req: Request, res: Response) => {
    const { user } = req;

    if (!user) {
      res.status(401).json({
        error: { code: "MISSING_TOKEN", message: "Authorization token is required" },
      });
      return;
    }

    const userRecord = authService.getUserById(user.userId);

    if (!userRecord) {
      res.status(404).json({
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
      return;
    }

    res.status(200).json({
      id: userRecord.id,
      email: userRecord.email,
      createdAt: userRecord.createdAt,
    });
  });

  router.post("/auth/logout", (req: Request, res: Response) => {
    const parsed = LogoutSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    const ctx = getAuditContext(req);
    try {
      authService.logout(parsed.data.refreshToken);
      logAuditEvent("LOGOUT", ctx);
      res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  router.post(
    "/auth/change-password",
    authenticateToken,
    rateLimiter,
    async (req: Request, res: Response) => {
      if (!req.user) {
        res
          .status(401)
          .json({ error: { code: "MISSING_TOKEN", message: "Authorization token is required" } });
        return;
      }
      const parsed = ChangePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        zodError(res, parsed.error);
        return;
      }

      const ctx = getAuditContext(req);
      try {
        await authService.changePassword(
          req.user.userId,
          parsed.data.currentPassword,
          parsed.data.newPassword,
        );
        logAuditEvent("PASSWORD_CHANGE", { ...ctx, userId: req.user.userId });
        res.status(200).json({ message: "Password changed successfully" });
      } catch (err) {
        handleAuthError(err, res);
      }
    },
  );

  router.post("/auth/logout-all", authenticateToken, (req: Request, res: Response) => {
    if (!req.user) {
      res
        .status(401)
        .json({ error: { code: "MISSING_TOKEN", message: "Authorization token is required" } });
      return;
    }
    const ctx = getAuditContext(req);
    try {
      authService.logoutAll(req.user.userId);
      logAuditEvent("LOGOUT_ALL", { ...ctx, userId: req.user.userId });
      res.status(200).json({ message: "All sessions revoked successfully" });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  router.patch("/auth/me", authenticateToken, async (req: Request, res: Response) => {
    if (!req.user) {
      res
        .status(401)
        .json({ error: { code: "MISSING_TOKEN", message: "Authorization token is required" } });
      return;
    }
    const parsed = UpdateEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    const ctx = getAuditContext(req);
    try {
      await authService.updateEmail(req.user.userId, parsed.data.newEmail, parsed.data.password);
      logAuditEvent("EMAIL_CHANGE", {
        ...ctx,
        userId: req.user.userId,
        meta: { newEmail: parsed.data.newEmail },
      });
      res.status(200).json({ message: "Email updated successfully" });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  router.delete("/auth/me", authenticateToken, async (req: Request, res: Response) => {
    if (!req.user) {
      res
        .status(401)
        .json({ error: { code: "MISSING_TOKEN", message: "Authorization token is required" } });
      return;
    }
    const parsed = DeleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    const ctx = getAuditContext(req);
    try {
      await authService.deleteAccount(req.user.userId, parsed.data.password);
      logAuditEvent("ACCOUNT_DELETED", { ...ctx, userId: req.user.userId });
      res.status(200).json({ message: "Account deleted successfully" });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  router.get("/auth/sessions", authenticateToken, (req: Request, res: Response) => {
    if (!req.user) {
      res
        .status(401)
        .json({ error: { code: "MISSING_TOKEN", message: "Authorization token is required" } });
      return;
    }
    const sessions = listUserSessions(req.user.userId);
    res.status(200).json({ sessions });
  });

  router.delete("/auth/sessions/:sessionId", authenticateToken, (req: Request, res: Response) => {
    if (!req.user) {
      res
        .status(401)
        .json({ error: { code: "MISSING_TOKEN", message: "Authorization token is required" } });
      return;
    }
    const { sessionId } = req.params;
    const ctx = getAuditContext(req);
    try {
      revokeSessionById(sessionId, req.user.userId);
      logAuditEvent("SESSION_REVOKED", {
        ...ctx,
        userId: req.user.userId,
        meta: { sessionId },
      });
      res.status(200).json({ message: "Session revoked successfully" });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  router.post("/auth/forgot-password", rateLimiter, async (req: Request, res: Response) => {
    const parsed = ForgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    const ctx = getAuditContext(req);
    try {
      const resetToken = await authService.requestPasswordReset(parsed.data.email);
      logAuditEvent("PASSWORD_RESET_REQUEST", { ...ctx, email: parsed.data.email });
      // In production this token would be emailed; here we return it for testability
      res.status(200).json({ message: "Password reset token issued", resetToken });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  router.post("/auth/reset-password", rateLimiter, async (req: Request, res: Response) => {
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    const ctx = getAuditContext(req);
    try {
      await authService.resetPassword(parsed.data.token, parsed.data.newPassword);
      logAuditEvent("PASSWORD_RESET", ctx);
      res.status(200).json({ message: "Password reset successfully" });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  return router;
}
