import type { Request, Response, NextFunction } from "express";
import { createId } from "@paralleldrive/cuid2";
import type { TokenPayload } from "../auth/types";
import { verifyAccessToken } from "../auth/token";
import { AuthError } from "../auth/errors";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "MISSING_TOKEN", message: "Authorization token is required" },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    res.status(401).json({
      error: { code: "INVALID_TOKEN", message: "Invalid access token" },
    });
  }
}

export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers["x-request-id"] as string | undefined) ?? createId();
  res.setHeader("x-request-id", id);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const requestId = res.getHeader("x-request-id") ?? "-";
    process.stdout.write(
      `${req.method} ${req.path} ${res.statusCode} ${duration}ms [${requestId}]\n`,
    );
  });
  next();
}
