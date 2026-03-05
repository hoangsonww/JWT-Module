import type { Request, Response, NextFunction } from "express";
import { authenticateToken } from "../api/middleware";
import { generateAccessToken } from "../auth/token";
import { AuthError } from "../auth/errors";
import type { TokenPayload } from "../auth/types";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});

afterAll(() => {
  delete process.env.JWT_ACCESS_SECRET;
  delete process.env.JWT_REFRESH_SECRET;
});

function createMockReqResNext(authHeader?: string) {
  const req = {
    headers: {
      authorization: authHeader,
    },
  } as unknown as Request;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const next = jest.fn() as NextFunction;

  return { req, res, next };
}

describe("authenticateToken middleware", () => {
  const testPayload: TokenPayload = {
    userId: "user-456",
    email: "middleware@example.com",
  };

  it("should call next when valid token is in Authorization header", () => {
    const token = generateAccessToken(testPayload);
    const { req, res, next } = createMockReqResNext(`Bearer ${token}`);

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe(testPayload.userId);
    expect(req.user!.email).toBe(testPayload.email);
  });

  it("should return 401 when no Authorization header", () => {
    const { req, res, next } = createMockReqResNext(undefined);

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "MISSING_TOKEN" }),
      }),
    );
  });

  it("should return 401 when token format is wrong (no Bearer prefix)", () => {
    const token = generateAccessToken(testPayload);
    const { req, res, next } = createMockReqResNext(token);

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should return 401 when token is invalid", () => {
    const { req, res, next } = createMockReqResNext("Bearer invalid.token.value");

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should return 401 when token is expired", () => {
    const jwt = require("jsonwebtoken");
    const expired = jwt.sign(
      { userId: "user-456", email: "middleware@example.com" },
      "test-access-secret",
      { expiresIn: "0s" },
    );
    const { req, res, next } = createMockReqResNext(`Bearer ${expired}`);

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should attach decoded payload to req.user", () => {
    const token = generateAccessToken(testPayload);
    const { req, res, next } = createMockReqResNext(`Bearer ${token}`);

    authenticateToken(req, res, next);

    expect(req.user).toEqual({
      userId: testPayload.userId,
      email: testPayload.email,
    });
  });

  it("should return 401 with INVALID_TOKEN when verifyAccessToken throws a non-AuthError", () => {
    // To trigger the non-AuthError catch branch, we need verifyAccessToken to throw
    // a plain Error. We can do this by temporarily removing the secret so getSecret
    // throws, but getSecret throws AuthError. Instead, we mock verifyAccessToken.
    const tokenModule = require("../auth/token");
    const originalVerify = tokenModule.verifyAccessToken;

    tokenModule.verifyAccessToken = () => {
      throw new Error("unexpected internal error");
    };

    try {
      const { req, res, next } = createMockReqResNext("Bearer some.valid-looking.token");

      authenticateToken(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: "INVALID_TOKEN", message: "Invalid access token" }),
        }),
      );
    } finally {
      tokenModule.verifyAccessToken = originalVerify;
    }
  });
});
