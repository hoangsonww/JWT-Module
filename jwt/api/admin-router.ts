import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuditEvents, getAuditEventCount } from "../auth/audit-log";
import { getSessionCount } from "../auth/session";
import type { AuthService } from "./app";

function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.status(503).json({
      error: { code: "ADMIN_DISABLED", message: "Admin API is not configured" },
    });
    return;
  }
  if (req.headers["x-admin-key"] !== adminKey) {
    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Invalid admin key" },
    });
    return;
  }
  next();
}

export function createAdminRouter(authService: AuthService): Router {
  const router = Router();

  router.get("/admin/users", requireAdminKey, (_req: Request, res: Response) => {
    res.status(200).json({ users: authService.listUsers() });
  });

  router.get("/admin/audit", requireAdminKey, (req: Request, res: Response) => {
    const rawLimit = parseInt(req.query["limit"] as string, 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 1000) : 100;
    res.status(200).json({ events: getAuditEvents(limit) });
  });

  router.get("/admin/stats", requireAdminKey, (_req: Request, res: Response) => {
    const mem = process.memoryUsage();
    res.status(200).json({
      users: authService.getUserCount(),
      activeSessions: getSessionCount(),
      auditEvents: getAuditEventCount(),
      uptime: Math.round(process.uptime()),
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
    });
  });

  return router;
}
