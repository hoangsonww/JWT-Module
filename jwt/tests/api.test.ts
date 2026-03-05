import request from "supertest";
import { createApp } from "../api/app";
import * as authService from "../auth/auth-service";
import { clearRevokedTokens } from "../auth/token";
import { clearRateLimitWindows } from "../api/rate-limiter";
import { clearLoginAttempts, clearUserTokens } from "../auth/auth-service";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});

afterAll(() => {
  delete process.env.JWT_ACCESS_SECRET;
  delete process.env.JWT_REFRESH_SECRET;
});

afterEach(() => {
  clearRevokedTokens();
  clearLoginAttempts();
  clearUserTokens();
  clearRateLimitWindows();
});

const app = createApp(authService);

async function registerUser(email: string, password = "Password1") {
  const res = await request(app).post("/auth/register").send({ email, password });
  return res.body.tokens as { accessToken: string; refreshToken: string };
}

describe("API integration tests", () => {
  describe("POST /auth/register", () => {
    it("should return 201 with tokens for valid input", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ email: "api-reg@example.com", password: "password123" });

      expect(res.status).toBe(201);
      expect(res.body.tokens).toHaveProperty("accessToken");
      expect(res.body.tokens).toHaveProperty("refreshToken");
    });

    it("should return 409 for duplicate email", async () => {
      await request(app)
        .post("/auth/register")
        .send({ email: "api-dup@example.com", password: "password123" });

      const res = await request(app)
        .post("/auth/register")
        .send({ email: "api-dup@example.com", password: "otherpass1" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
    });

    it("should return 400 for invalid email", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ email: "not-valid", password: "password123" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_EMAIL");
    });

    it("should return 400 for missing fields", async () => {
      const res = await request(app).post("/auth/register").send({ email: "missing@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_INPUT");
    });
  });

  describe("POST /auth/login", () => {
    it("should return 200 with tokens for valid credentials", async () => {
      await request(app)
        .post("/auth/register")
        .send({ email: "api-login@example.com", password: "mypassword1" });

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "api-login@example.com", password: "mypassword1" });

      expect(res.status).toBe(200);
      expect(res.body.tokens).toHaveProperty("accessToken");
      expect(res.body.tokens).toHaveProperty("refreshToken");
    });

    it("should return 401 for invalid credentials", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "api-login-bad@example.com", password: "wrong1234" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });
  });

  describe("POST /auth/refresh", () => {
    it("should return 200 with new tokens for valid refresh token", async () => {
      const regRes = await request(app)
        .post("/auth/register")
        .send({ email: "api-refresh@example.com", password: "password123" });

      const res = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: regRes.body.tokens.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.tokens).toHaveProperty("accessToken");
      expect(res.body.tokens).toHaveProperty("refreshToken");
    });

    it("should return 401 for invalid refresh token", async () => {
      const res = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: "invalid.token.here" });

      expect(res.status).toBe(401);
    });

    it("should invalidate old refresh token after rotation", async () => {
      const tokens = await registerUser("api-rotation@example.com");

      // First refresh succeeds
      const res1 = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: tokens.refreshToken });
      expect(res1.status).toBe(200);

      // Second refresh with same old token should fail
      const res2 = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: tokens.refreshToken });
      expect(res2.status).toBe(401);
    });
  });

  describe("GET /auth/me", () => {
    it("should return 200 with user info when authenticated", async () => {
      const regRes = await request(app)
        .post("/auth/register")
        .send({ email: "api-me@example.com", password: "password123" });

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${regRes.body.tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.email).toBe("api-me@example.com");
      expect(res.body).toHaveProperty("createdAt");
    });

    it("should return 401 without token", async () => {
      const res = await request(app).get("/auth/me");

      expect(res.status).toBe(401);
    });

    it("should return 401 with invalid token", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer invalid.token.value");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /health", () => {
    it("should return 200 with status ok", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("POST /auth/register - password validation", () => {
    it("should return 400 with WEAK_PASSWORD for a weak password", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ email: "weakpw-api@example.com", password: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("WEAK_PASSWORD");
    });
  });

  describe("POST /auth/logout", () => {
    it("should return 200 and revoke the refresh token", async () => {
      const regRes = await request(app)
        .post("/auth/register")
        .send({ email: "api-logout@example.com", password: "password123" });

      const res = await request(app)
        .post("/auth/logout")
        .send({ refreshToken: regRes.body.tokens.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Logged out successfully");
    });

    it("should cause POST /auth/refresh to fail with 401 after logout", async () => {
      const regRes = await request(app)
        .post("/auth/register")
        .send({ email: "api-logout2@example.com", password: "password123" });

      await request(app)
        .post("/auth/logout")
        .send({ refreshToken: regRes.body.tokens.refreshToken });

      const refreshRes = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: regRes.body.tokens.refreshToken });

      expect(refreshRes.status).toBe(401);
    });

    it("should return 400 when refreshToken is missing", async () => {
      const res = await request(app).post("/auth/logout").send({});

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/change-password", () => {
    it("should return 200 and allow login with new password", async () => {
      const regRes = await request(app)
        .post("/auth/register")
        .send({ email: "api-changepw@example.com", password: "password123" });

      const res = await request(app)
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${regRes.body.tokens.accessToken}`)
        .send({ currentPassword: "password123", newPassword: "newpassword1" });

      expect(res.status).toBe(200);

      const loginRes = await request(app)
        .post("/auth/login")
        .send({ email: "api-changepw@example.com", password: "newpassword1" });

      expect(loginRes.status).toBe(200);
    });

    it("should return 401 without auth token", async () => {
      const res = await request(app)
        .post("/auth/change-password")
        .send({ currentPassword: "password123", newPassword: "newpassword1" });

      expect(res.status).toBe(401);
    });

    it("should return 400 for missing fields", async () => {
      const regRes = await request(app)
        .post("/auth/register")
        .send({ email: "api-changepw2@example.com", password: "password123" });

      const res = await request(app)
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${regRes.body.tokens.accessToken}`)
        .send({ currentPassword: "password123" });

      expect(res.status).toBe(400);
    });

    it("should return 401 for wrong current password", async () => {
      const regRes = await request(app)
        .post("/auth/register")
        .send({ email: "api-changepw3@example.com", password: "password123" });

      const res = await request(app)
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${regRes.body.tokens.accessToken}`)
        .send({ currentPassword: "wrongpass1", newPassword: "newpassword1" });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/logout-all", () => {
    it("should revoke all tokens and cause refresh to fail", async () => {
      const tokens = await registerUser("api-logoutall@example.com");

      const res = await request(app)
        .post("/auth/logout-all")
        .set("Authorization", `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);

      const refreshRes = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: tokens.refreshToken });

      expect(refreshRes.status).toBe(401);
    });

    it("should return 401 without Bearer token", async () => {
      const res = await request(app).post("/auth/logout-all");
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /auth/me", () => {
    it("should update email successfully", async () => {
      const tokens = await registerUser("api-patch@example.com");

      const res = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${tokens.accessToken}`)
        .send({ newEmail: "updated@example.com", password: "Password1" });

      expect(res.status).toBe(200);

      // Verify the email was updated
      const meRes = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${tokens.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe("updated@example.com");
    });

    it("should return 401 without Bearer token", async () => {
      const res = await request(app)
        .patch("/auth/me")
        .send({ newEmail: "nope@example.com", password: "Password1" });

      expect(res.status).toBe(401);
    });

    it("should return 400 for missing fields", async () => {
      const tokens = await registerUser("api-patch-missing@example.com");

      const res = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${tokens.accessToken}`)
        .send({ newEmail: "x@example.com" });

      expect(res.status).toBe(400);
    });

    it("should return 409 for duplicate email", async () => {
      await registerUser("api-patch-taken@example.com");
      const tokens = await registerUser("api-patch-other@example.com");

      const res = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${tokens.accessToken}`)
        .send({ newEmail: "api-patch-taken@example.com", password: "Password1" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
    });
  });

  describe("DELETE /auth/me", () => {
    it("should delete the account successfully", async () => {
      const tokens = await registerUser("api-delete@example.com");

      const res = await request(app)
        .delete("/auth/me")
        .set("Authorization", `Bearer ${tokens.accessToken}`)
        .send({ password: "Password1" });

      expect(res.status).toBe(200);

      // User no longer exists; GET /auth/me returns 404
      const meRes = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${tokens.accessToken}`);

      expect(meRes.status).toBe(404);
    });

    it("should return 401 without Bearer token", async () => {
      const res = await request(app).delete("/auth/me").send({ password: "Password1" });

      expect(res.status).toBe(401);
    });

    it("should return 401 for wrong password", async () => {
      const tokens = await registerUser("api-delete-wrong@example.com");

      const res = await request(app)
        .delete("/auth/me")
        .set("Authorization", `Bearer ${tokens.accessToken}`)
        .send({ password: "WrongPass1" });

      expect(res.status).toBe(401);
    });
  });

  describe("account lockout via API", () => {
    it("should return 423 ACCOUNT_LOCKED after 5 failed logins", async () => {
      await registerUser("api-lockout@example.com");

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/auth/login")
          .send({ email: "api-lockout@example.com", password: "WrongPass1" });
      }

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "api-lockout@example.com", password: "WrongPass1" });

      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
    });
  });

  describe("rate limiter", () => {
    it("should allow the 20th request and reject the 21st on a rate-limited endpoint", async () => {
      // Login to a non-existent user is fast (no bcrypt) and goes through rateLimiter
      for (let i = 0; i < 20; i++) {
        const res = await request(app)
          .post("/auth/login")
          .send({ email: `rl-test${i}@example.com`, password: "Password1" });
        expect(res.status).not.toBe(429);
      }

      // 21st request should be rate limited
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "rl-test-over@example.com", password: "Password1" });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("RATE_LIMITED");
    });

    it("should reset after clearRateLimitWindows", async () => {
      // Exhaust limit
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post("/auth/login")
          .send({ email: "nobody@example.com", password: "Password1" });
      }

      // Should be rate limited now
      const limited = await request(app)
        .post("/auth/login")
        .send({ email: "nobody@example.com", password: "Password1" });
      expect(limited.status).toBe(429);

      clearRateLimitWindows();

      // Should no longer be rate limited
      const afterClear = await request(app)
        .post("/auth/login")
        .send({ email: "nobody@example.com", password: "Password1" });
      expect(afterClear.status).not.toBe(429);
    });
  });

  describe("full flow", () => {
    it("should register, login, access protected route, refresh, and access again", async () => {
      // Register
      const regRes = await request(app)
        .post("/auth/register")
        .send({ email: "api-flow@example.com", password: "flowpass1" });
      expect(regRes.status).toBe(201);

      // Login
      const loginRes = await request(app)
        .post("/auth/login")
        .send({ email: "api-flow@example.com", password: "flowpass1" });
      expect(loginRes.status).toBe(200);
      const loginTokens = loginRes.body.tokens;

      // Access protected route
      const meRes = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${loginTokens.accessToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe("api-flow@example.com");

      // Refresh tokens
      const refreshRes = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: loginTokens.refreshToken });
      expect(refreshRes.status).toBe(200);
      const newTokens = refreshRes.body.tokens;

      // Access protected route with new token
      const meRes2 = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${newTokens.accessToken}`);
      expect(meRes2.status).toBe(200);
      expect(meRes2.body.email).toBe("api-flow@example.com");
    });
  });
});
