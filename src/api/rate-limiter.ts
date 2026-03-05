import type { Request, Response, NextFunction } from "express";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 20;

const windows = new Map<string, WindowEntry>();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.ip
    ?? "unknown";
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    res.status(429).json({
      error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" },
    });
    return;
  }

  entry.count++;
  next();
}

export function clearRateLimitWindows(): void {
  windows.clear();
}
