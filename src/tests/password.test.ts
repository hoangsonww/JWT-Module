import { hashPassword, verifyPassword, validatePasswordStrength } from "../auth/password";
import { AuthError } from "../auth/errors";

describe("password utilities", () => {
  describe("hashPassword", () => {
    it("should return a bcrypt hash starting with $2b$", async () => {
      const hash = await hashPassword("mypassword1");
      expect(hash).toMatch(/^\$2b\$/);
    });

    it("should produce different hashes for the same input due to salt", async () => {
      const hash1 = await hashPassword("samepassword1");
      const hash2 = await hashPassword("samepassword1");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", async () => {
      const hash = await hashPassword("");
      expect(hash).toMatch(/^\$2b\$/);
    });

    it("should handle long passwords", async () => {
      const longPassword = "a".repeat(72);
      const hash = await hashPassword(longPassword);
      expect(hash).toMatch(/^\$2b\$/);
    });
  });

  describe("verifyPassword", () => {
    it("should return true for correct password", async () => {
      const hash = await hashPassword("correct1");
      const result = await verifyPassword("correct1", hash);
      expect(result).toBe(true);
    });

    it("should return false for wrong password", async () => {
      const hash = await hashPassword("correct1");
      const result = await verifyPassword("wrong123", hash);
      expect(result).toBe(false);
    });
  });

  describe("validatePasswordStrength", () => {
    it("should not throw for a valid password", () => {
      expect(() => validatePasswordStrength("password1")).not.toThrow();
    });

    it("should throw WEAK_PASSWORD if password is shorter than 8 characters", () => {
      expect(() => validatePasswordStrength("pass1")).toThrow(AuthError);
      try {
        validatePasswordStrength("pass1");
      } catch (err) {
        expect((err as AuthError).code).toBe("WEAK_PASSWORD");
      }
    });

    it("should throw WEAK_PASSWORD if password has no letters", () => {
      expect(() => validatePasswordStrength("12345678")).toThrow(AuthError);
      try {
        validatePasswordStrength("12345678");
      } catch (err) {
        expect((err as AuthError).code).toBe("WEAK_PASSWORD");
      }
    });

    it("should throw WEAK_PASSWORD if password has no digits", () => {
      expect(() => validatePasswordStrength("password")).toThrow(AuthError);
      try {
        validatePasswordStrength("password");
      } catch (err) {
        expect((err as AuthError).code).toBe("WEAK_PASSWORD");
      }
    });

    it("should handle 72+ character passwords without throwing", () => {
      const longPassword = "a".repeat(70) + "12";
      expect(() => validatePasswordStrength(longPassword)).not.toThrow();
    });

    it("should handle passwords longer than bcrypt 72 byte limit", () => {
      const veryLong = "Abcdefgh1" + "x".repeat(100);
      expect(() => validatePasswordStrength(veryLong)).not.toThrow();
    });

    it("should accept passwords with unicode characters", () => {
      expect(() => validatePasswordStrength("p\u00e4ssw\u00f6rd1")).not.toThrow();
    });

    it("should accept passwords with emoji and special unicode", () => {
      expect(() => validatePasswordStrength("hello\ud83d\ude00\ud83d\ude00\ud83d\ude001")).not.toThrow();
    });
  });

  describe("edge cases with bcrypt and long passwords", () => {
    it("should hash and verify a 72+ character password", async () => {
      const longPassword = "Password1" + "x".repeat(100);
      const hash = await hashPassword(longPassword);
      const result = await verifyPassword(longPassword, hash);
      expect(result).toBe(true);
    });

    it("should hash and verify unicode passwords", async () => {
      const unicodePassword = "\u00fcber\u00e9l\u00e8ve1";
      const hash = await hashPassword(unicodePassword);
      const result = await verifyPassword(unicodePassword, hash);
      expect(result).toBe(true);
    });
  });
});
