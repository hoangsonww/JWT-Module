import {
  register,
  login,
  refreshTokens,
  getUserById,
  logout,
  changePassword,
  logoutAll,
  updateEmail,
  deleteAccount,
  clearLoginAttempts,
  clearUserTokens,
} from "../auth/auth-service";
import { AuthError } from "../auth/errors";
import { clearRevokedTokens } from "../auth/token";

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
});

function decodeUserId(accessToken: string): string {
  const jwt = require("jsonwebtoken");
  return (jwt.decode(accessToken) as { userId: string }).userId;
}

describe("AuthService", () => {
  describe("register", () => {
    it("should return tokens for valid input", async () => {
      const tokens = await register({
        email: "newuser@example.com",
        password: "password123",
      });
      expect(tokens).toHaveProperty("accessToken");
      expect(tokens).toHaveProperty("refreshToken");
      expect(typeof tokens.accessToken).toBe("string");
      expect(typeof tokens.refreshToken).toBe("string");
    });

    it("should throw DUPLICATE_EMAIL on duplicate registration", async () => {
      await register({
        email: "duplicate@example.com",
        password: "password123",
      });

      await expect(
        register({ email: "duplicate@example.com", password: "otherpass1" }),
      ).rejects.toThrow(AuthError);

      try {
        await register({ email: "duplicate@example.com", password: "otherpass1" });
      } catch (err) {
        expect((err as AuthError).code).toBe("DUPLICATE_EMAIL");
      }
    });

    it("should throw INVALID_EMAIL for malformed email", async () => {
      await expect(register({ email: "not-an-email", password: "password123" })).rejects.toThrow(
        AuthError,
      );

      try {
        await register({ email: "not-an-email", password: "password123" });
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_EMAIL");
      }
    });
  });

  describe("login", () => {
    it("should return tokens for valid credentials", async () => {
      await register({
        email: "loginuser@example.com",
        password: "mypassword1",
      });

      const tokens = await login({
        email: "loginuser@example.com",
        password: "mypassword1",
      });

      expect(tokens).toHaveProperty("accessToken");
      expect(tokens).toHaveProperty("refreshToken");
    });

    it("should throw INVALID_CREDENTIALS for wrong password", async () => {
      await register({
        email: "wrongpass@example.com",
        password: "correct123",
      });

      await expect(
        login({ email: "wrongpass@example.com", password: "incorrect1" }),
      ).rejects.toThrow(AuthError);

      try {
        await login({ email: "wrongpass@example.com", password: "incorrect1" });
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_CREDENTIALS");
      }
    });

    it("should throw INVALID_CREDENTIALS for non-existent email", async () => {
      await expect(login({ email: "noexist@example.com", password: "password1" })).rejects.toThrow(
        AuthError,
      );

      try {
        await login({ email: "noexist@example.com", password: "password1" });
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_CREDENTIALS");
      }
    });
  });

  describe("account lockout", () => {
    it("should throw ACCOUNT_LOCKED after 5 consecutive failed logins", async () => {
      await register({ email: "lockout@example.com", password: "Password1" });

      for (let i = 0; i < 5; i++) {
        await expect(
          login({ email: "lockout@example.com", password: "WrongPass1" }),
        ).rejects.toThrow(AuthError);
      }

      try {
        await login({ email: "lockout@example.com", password: "WrongPass1" });
      } catch (err) {
        expect((err as AuthError).code).toBe("ACCOUNT_LOCKED");
      }
    });

    it("should reset lockout counter on successful login", async () => {
      await register({ email: "lockoutreset@example.com", password: "Password1" });

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        await login({ email: "lockoutreset@example.com", password: "WrongPass1" }).catch(() => {});
      }

      // Successful login resets counter
      const tokens = await login({ email: "lockoutreset@example.com", password: "Password1" });
      expect(tokens).toHaveProperty("accessToken");

      // Fail 4 more times should not lock (counter was reset)
      for (let i = 0; i < 4; i++) {
        await login({ email: "lockoutreset@example.com", password: "WrongPass1" }).catch(() => {});
      }

      // 5th failure after reset should not cause ACCOUNT_LOCKED yet (only 4 failures)
      try {
        await login({ email: "lockoutreset@example.com", password: "WrongPass1" });
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_CREDENTIALS");
      }
    });
  });

  describe("refreshTokens", () => {
    it("should return new token pair for valid refresh token", async () => {
      const original = await register({
        email: "refresh@example.com",
        password: "password123",
      });

      const newTokens = refreshTokens(original.refreshToken);
      expect(newTokens).toHaveProperty("accessToken");
      expect(newTokens).toHaveProperty("refreshToken");
    });

    it("should throw on invalid refresh token", () => {
      expect(() => refreshTokens("invalid.token.here")).toThrow(AuthError);
    });

    it("should invalidate the old refresh token after rotation", async () => {
      const original = await register({
        email: "rotation@example.com",
        password: "Password1",
      });

      const newTokens = refreshTokens(original.refreshToken);
      expect(newTokens).toHaveProperty("accessToken");

      // Old token should now be revoked
      try {
        refreshTokens(original.refreshToken);
        fail("Expected AuthError");
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_TOKEN");
      }
    });

    it("should allow using the new refresh token after rotation", async () => {
      const original = await register({
        email: "rotation2@example.com",
        password: "Password1",
      });

      // Wait to ensure JWT iat differs (JWT iat is in seconds)
      await new Promise((r) => setTimeout(r, 1100));

      const newTokens = refreshTokens(original.refreshToken);
      expect(newTokens).toHaveProperty("accessToken");
      expect(newTokens).toHaveProperty("refreshToken");

      // The new refresh token should be usable
      const newerTokens = refreshTokens(newTokens.refreshToken);
      expect(newerTokens).toHaveProperty("accessToken");
      expect(newerTokens).toHaveProperty("refreshToken");
    }, 10000);
  });

  describe("register - password validation", () => {
    it("should throw WEAK_PASSWORD for weak passwords", async () => {
      await expect(register({ email: "weakpw@example.com", password: "abc" })).rejects.toThrow(
        AuthError,
      );

      try {
        await register({ email: "weakpw@example.com", password: "abc" });
      } catch (err) {
        expect((err as AuthError).code).toBe("WEAK_PASSWORD");
      }
    });
  });

  describe("logout", () => {
    it("should revoke the refresh token so refresh fails", async () => {
      const tokens = await register({
        email: "logout@example.com",
        password: "password123",
      });

      logout(tokens.refreshToken);

      expect(() => refreshTokens(tokens.refreshToken)).toThrow(AuthError);
      try {
        refreshTokens(tokens.refreshToken);
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_TOKEN");
      }
    });
  });

  describe("logoutAll", () => {
    it("should revoke all refresh tokens for a user", async () => {
      const tokens1 = await register({
        email: "logoutall@example.com",
        password: "Password1",
      });
      const userId = decodeUserId(tokens1.accessToken);

      // Login again to get a second token set
      const tokens2 = await login({
        email: "logoutall@example.com",
        password: "Password1",
      });

      logoutAll(userId);

      // Both refresh tokens should be revoked
      expect(() => refreshTokens(tokens1.refreshToken)).toThrow(AuthError);
      expect(() => refreshTokens(tokens2.refreshToken)).toThrow(AuthError);
    });
  });

  describe("changePassword", () => {
    it("should succeed with correct credentials and valid new password", async () => {
      const tokens = await register({
        email: "changepw@example.com",
        password: "password123",
      });
      const userId = decodeUserId(tokens.accessToken);

      await expect(changePassword(userId, "password123", "newpassword1")).resolves.toBeUndefined();
    });

    it("should throw INVALID_CREDENTIALS for wrong current password", async () => {
      const tokens = await register({
        email: "changepw-wrong@example.com",
        password: "password123",
      });
      const userId = decodeUserId(tokens.accessToken);

      await expect(changePassword(userId, "wrongpass1", "newpassword1")).rejects.toThrow(AuthError);

      try {
        await changePassword(userId, "wrongpass1", "newpassword1");
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_CREDENTIALS");
      }
    });

    it("should throw WEAK_PASSWORD for weak new password", async () => {
      const tokens = await register({
        email: "changepw-weak@example.com",
        password: "password123",
      });
      const userId = decodeUserId(tokens.accessToken);

      await expect(changePassword(userId, "password123", "abc")).rejects.toThrow(AuthError);

      try {
        await changePassword(userId, "password123", "abc");
      } catch (err) {
        expect((err as AuthError).code).toBe("WEAK_PASSWORD");
      }
    });

    it("should throw USER_NOT_FOUND for non-existent userId", async () => {
      await expect(changePassword("nonexistent-id", "password123", "newpassword1")).rejects.toThrow(
        AuthError,
      );

      try {
        await changePassword("nonexistent-id", "password123", "newpassword1");
      } catch (err) {
        expect((err as AuthError).code).toBe("USER_NOT_FOUND");
      }
    });

    it("should revoke all tokens after password change", async () => {
      const tokens = await register({
        email: "changepw-revoke@example.com",
        password: "Password1",
      });
      const userId = decodeUserId(tokens.accessToken);

      await changePassword(userId, "Password1", "NewPass12");

      // Old refresh token should be revoked
      expect(() => refreshTokens(tokens.refreshToken)).toThrow(AuthError);
      try {
        refreshTokens(tokens.refreshToken);
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_TOKEN");
      }
    });
  });

  describe("updateEmail", () => {
    it("should update email successfully", async () => {
      const tokens = await register({
        email: "oldemail@example.com",
        password: "Password1",
      });
      const userId = decodeUserId(tokens.accessToken);

      await updateEmail(userId, "newemail@example.com", "Password1");

      const user = getUserById(userId);
      expect(user!.email).toBe("newemail@example.com");
    });

    it("should throw DUPLICATE_EMAIL if email is taken", async () => {
      await register({ email: "taken@example.com", password: "Password1" });
      const tokens = await register({ email: "other@example.com", password: "Password1" });
      const userId = decodeUserId(tokens.accessToken);

      try {
        await updateEmail(userId, "taken@example.com", "Password1");
        fail("Expected AuthError");
      } catch (err) {
        expect((err as AuthError).code).toBe("DUPLICATE_EMAIL");
      }
    });

    it("should throw INVALID_CREDENTIALS for wrong password", async () => {
      const tokens = await register({
        email: "emailwrongpw@example.com",
        password: "Password1",
      });
      const userId = decodeUserId(tokens.accessToken);

      try {
        await updateEmail(userId, "new@example.com", "WrongPass1");
        fail("Expected AuthError");
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_CREDENTIALS");
      }
    });

    it("should throw USER_NOT_FOUND for bad userId", async () => {
      try {
        await updateEmail("nonexistent-id", "new@example.com", "Password1");
        fail("Expected AuthError");
      } catch (err) {
        expect((err as AuthError).code).toBe("USER_NOT_FOUND");
      }
    });

    it("should throw INVALID_EMAIL for bad format", async () => {
      const tokens = await register({
        email: "validformat@example.com",
        password: "Password1",
      });
      const userId = decodeUserId(tokens.accessToken);

      try {
        await updateEmail(userId, "not-an-email", "Password1");
        fail("Expected AuthError");
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_EMAIL");
      }
    });
  });

  describe("deleteAccount", () => {
    it("should delete the user so getUserById returns undefined", async () => {
      const tokens = await register({
        email: "deleteme@example.com",
        password: "Password1",
      });
      const userId = decodeUserId(tokens.accessToken);

      await deleteAccount(userId, "Password1");

      expect(getUserById(userId)).toBeUndefined();
    });

    it("should throw INVALID_CREDENTIALS for wrong password", async () => {
      const tokens = await register({
        email: "deletewrong@example.com",
        password: "Password1",
      });
      const userId = decodeUserId(tokens.accessToken);

      try {
        await deleteAccount(userId, "WrongPass1");
        fail("Expected AuthError");
      } catch (err) {
        expect((err as AuthError).code).toBe("INVALID_CREDENTIALS");
      }
    });
  });

  describe("getUserById", () => {
    it("should return user after registration", async () => {
      const tokens = await register({
        email: "getuser@example.com",
        password: "password123",
      });
      const userId = decodeUserId(tokens.accessToken);
      const user = getUserById(userId);

      expect(user).toBeDefined();
      expect(user!.email).toBe("getuser@example.com");
    });

    it("should return undefined for unknown id", () => {
      const user = getUserById("nonexistent-id");
      expect(user).toBeUndefined();
    });
  });
});
