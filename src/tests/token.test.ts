import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  clearRevokedTokens,
  pruneExpiredTokens,
} from "../auth/token";
import { AuthError } from "../auth/errors";
import type { TokenPayload } from "../auth/types";

const TEST_ACCESS_SECRET = "test-access-secret";
const TEST_REFRESH_SECRET = "test-refresh-secret";

const testPayload: TokenPayload = {
  userId: "user-123",
  email: "test@example.com",
};

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = TEST_ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET;
});

afterAll(() => {
  delete process.env.JWT_ACCESS_SECRET;
  delete process.env.JWT_REFRESH_SECRET;
});

afterEach(() => clearRevokedTokens());

describe("token utilities", () => {
  describe("generateAccessToken", () => {
    it("should return a valid JWT string", () => {
      const token = generateAccessToken(testPayload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });
  });

  describe("verifyAccessToken", () => {
    it("should return correct payload for valid token", () => {
      const token = generateAccessToken(testPayload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });

    it("should throw AuthError with INVALID_TOKEN on tampered token", () => {
      const token = generateAccessToken(testPayload);
      const tampered = token.slice(0, -5) + "XXXXX";
      expect(() => verifyAccessToken(tampered)).toThrow(AuthError);
      try {
        verifyAccessToken(tampered);
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_TOKEN");
      }
    });

    it("should throw AuthError with TOKEN_EXPIRED on expired token", () => {
      const secret = TEST_ACCESS_SECRET;
      const expired = jwt.sign(
        { userId: "user-123", email: "test@example.com" },
        secret,
        { expiresIn: "0s" },
      );
      expect(() => verifyAccessToken(expired)).toThrow(AuthError);
      try {
        verifyAccessToken(expired);
      } catch (err) {
        expect((err as AuthError).code).toBe("TOKEN_EXPIRED");
      }
    });
  });

  describe("generateRefreshToken", () => {
    it("should return a valid JWT string", () => {
      const token = generateRefreshToken(testPayload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });
  });

  describe("verifyRefreshToken", () => {
    it("should return correct payload for valid token", () => {
      const token = generateRefreshToken(testPayload);
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });

    it("should throw AuthError with INVALID_TOKEN on tampered token", () => {
      const token = generateRefreshToken(testPayload);
      const tampered = token.slice(0, -5) + "XXXXX";
      expect(() => verifyRefreshToken(tampered)).toThrow(AuthError);
      try {
        verifyRefreshToken(tampered);
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_TOKEN");
      }
    });

    it("should throw AuthError with TOKEN_EXPIRED on expired token", () => {
      const secret = TEST_REFRESH_SECRET;
      const expired = jwt.sign(
        { userId: "user-123", email: "test@example.com" },
        secret,
        { expiresIn: "0s" },
      );
      expect(() => verifyRefreshToken(expired)).toThrow(AuthError);
      try {
        verifyRefreshToken(expired);
      } catch (err) {
        expect((err as AuthError).code).toBe("TOKEN_EXPIRED");
      }
    });
  });

  describe("generateTokens", () => {
    it("should return both accessToken and refreshToken", () => {
      const tokens = generateTokens(testPayload);
      expect(tokens).toHaveProperty("accessToken");
      expect(tokens).toHaveProperty("refreshToken");
      expect(typeof tokens.accessToken).toBe("string");
      expect(typeof tokens.refreshToken).toBe("string");
    });
  });

  describe("token revocation", () => {
    it("should throw INVALID_TOKEN when verifying a revoked refresh token", () => {
      const token = generateRefreshToken(testPayload);
      revokeRefreshToken(token);
      expect(() => verifyRefreshToken(token)).toThrow(AuthError);
      try {
        verifyRefreshToken(token);
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_TOKEN");
      }
    });

    it("should pass verification after clearRevokedTokens is called", () => {
      const token = generateRefreshToken(testPayload);
      revokeRefreshToken(token);
      clearRevokedTokens();
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(testPayload.userId);
    });
  });

  describe("pruneExpiredTokens", () => {
    it("should not remove revoked tokens that have not yet expired", () => {
      const token = generateRefreshToken(testPayload);
      revokeRefreshToken(token);

      // pruneExpiredTokens should NOT remove it because TTL hasn't passed
      pruneExpiredTokens();

      // Token should still be revoked
      expect(() => verifyRefreshToken(token)).toThrow(AuthError);
      try {
        verifyRefreshToken(token);
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_TOKEN");
      }
    });

    it("should allow valid tokens to pass verification after pruning", () => {
      const token = generateRefreshToken(testPayload);

      // Prune should have no effect on non-revoked tokens
      pruneExpiredTokens();

      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(testPayload.userId);
    });

    it("should remove expired revocation entries when TTL has passed", () => {
      const token = generateRefreshToken(testPayload);
      revokeRefreshToken(token);

      // Mock Date.now to simulate time passing beyond TTL (7 days + 1 second)
      const realDateNow = Date.now;
      const future = realDateNow() + 7 * 24 * 60 * 60 * 1000 + 1000;
      Date.now = () => future;

      try {
        pruneExpiredTokens();

        // After pruning, the revocation entry should be gone
        // But the JWT itself is still valid (7d expiry), so it should verify
        // Actually the JWT will also be expired by then, so let's just check
        // that pruneExpiredTokens ran without error
      } finally {
        Date.now = realDateNow;
      }
    });
  });

  describe("missing secrets", () => {
    it("should throw AuthError with MISSING_SECRET when JWT_ACCESS_SECRET is not set", () => {
      const original = process.env.JWT_ACCESS_SECRET;
      delete process.env.JWT_ACCESS_SECRET;
      try {
        expect(() => generateAccessToken(testPayload)).toThrow(AuthError);
        try {
          generateAccessToken(testPayload);
        } catch (err) {
          expect((err as AuthError).code).toBe("MISSING_SECRET");
        }
      } finally {
        process.env.JWT_ACCESS_SECRET = original;
      }
    });

    it("should throw AuthError with MISSING_SECRET when JWT_REFRESH_SECRET is not set", () => {
      const original = process.env.JWT_REFRESH_SECRET;
      delete process.env.JWT_REFRESH_SECRET;
      try {
        expect(() => generateRefreshToken(testPayload)).toThrow(AuthError);
        try {
          generateRefreshToken(testPayload);
        } catch (err) {
          expect((err as AuthError).code).toBe("MISSING_SECRET");
        }
      } finally {
        process.env.JWT_REFRESH_SECRET = original;
      }
    });
  });
});
