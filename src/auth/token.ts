import jwt from "jsonwebtoken";
import { AuthError } from "./errors";
import type { AuthTokens, TokenPayload } from "./types";

const revokedTokens = new Map<string, number>();

const REVOCATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function revokeRefreshToken(token: string): void {
  revokedTokens.set(token, Date.now() + REVOCATION_TTL_MS);
}

export function clearRevokedTokens(): void {
  revokedTokens.clear();
}

export function pruneExpiredTokens(): void {
  const now = Date.now();
  for (const [token, expiry] of revokedTokens) {
    if (now > expiry) revokedTokens.delete(token);
  }
}

function getSecret(envVar: string): string {
  const secret = process.env[envVar];
  if (!secret) {
    throw new AuthError("MISSING_SECRET", `Environment variable ${envVar} is not set`);
  }
  return secret;
}

export function generateAccessToken(payload: TokenPayload): string {
  const secret = getSecret("JWT_ACCESS_SECRET");
  return jwt.sign(payload, secret, { expiresIn: "15m" });
}

export function generateRefreshToken(payload: TokenPayload): string {
  const secret = getSecret("JWT_REFRESH_SECRET");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  const secret = getSecret("JWT_ACCESS_SECRET");
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    return { userId: decoded.userId as string, email: decoded.email as string };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError("TOKEN_EXPIRED", "Access token has expired");
    }
    throw new AuthError("INVALID_TOKEN", "Invalid access token");
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  const expiry = revokedTokens.get(token);
  if (expiry !== undefined && Date.now() <= expiry) {
    throw new AuthError("INVALID_TOKEN", "Refresh token has been revoked");
  }
  if (expiry !== undefined) {
    revokedTokens.delete(token);
  }
  const secret = getSecret("JWT_REFRESH_SECRET");
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    return { userId: decoded.userId as string, email: decoded.email as string };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError("TOKEN_EXPIRED", "Refresh token has expired");
    }
    throw new AuthError("INVALID_TOKEN", "Invalid refresh token");
  }
}

export function generateTokens(payload: TokenPayload): AuthTokens {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
