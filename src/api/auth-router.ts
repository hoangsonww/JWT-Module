import { Router, type Request, type Response } from "express";
import { AuthError } from "../auth/errors";
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

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.post("/auth/register", rateLimiter, async (req: Request, res: Response) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    try {
      const tokens = await authService.register({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      res.status(201).json({ tokens });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  router.post("/auth/login", rateLimiter, async (req: Request, res: Response) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    try {
      const tokens = await authService.login({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      res.status(200).json({ tokens });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  router.post("/auth/refresh", rateLimiter, (req: Request, res: Response) => {
    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) {
      zodError(res, parsed.error);
      return;
    }

    try {
      const tokens = authService.refreshTokens(parsed.data.refreshToken);
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

    try {
      authService.logout(parsed.data.refreshToken);
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

      try {
        await authService.changePassword(
          req.user.userId,
          parsed.data.currentPassword,
          parsed.data.newPassword,
        );
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
    try {
      authService.logoutAll(req.user.userId);
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

    try {
      await authService.updateEmail(req.user.userId, parsed.data.newEmail, parsed.data.password);
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

    try {
      await authService.deleteAccount(req.user.userId, parsed.data.password);
      res.status(200).json({ message: "Account deleted successfully" });
    } catch (err) {
      handleAuthError(err, res);
    }
  });

  return router;
}
