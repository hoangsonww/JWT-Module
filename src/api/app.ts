import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import type { AuthTokens, LoginInput, RegisterInput, User, UserPublic } from "../auth/types";
import { createAdminRouter } from "./admin-router";
import { createAuthRouter } from "./auth-router";
import { attachRequestId, requestLogger } from "./middleware";

export interface AuthService {
  register(input: RegisterInput): Promise<AuthTokens>;
  login(input: LoginInput): Promise<AuthTokens>;
  refreshTokens(refreshToken: string): AuthTokens;
  getUserById(id: string): User | undefined;
  logout(refreshToken: string): void;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  logoutAll(userId: string): void;
  updateEmail(userId: string, newEmail: string, password: string): Promise<void>;
  deleteAccount(userId: string, password: string): Promise<void>;
  getUserCount(): number;
  listUsers(): UserPublic[];
  requestPasswordReset(email: string): Promise<string>;
  resetPassword(token: string, newPassword: string): Promise<void>;
}

export function createApp(authService: AuthService): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? "*",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
    }),
  );
  app.use(attachRequestId);
  app.use(requestLogger);
  app.use(express.json({ limit: "10kb" }));
  app.use(createAuthRouter(authService));
  app.use(createAdminRouter(authService));
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return app;
}
