# jwt-module

JWT authentication module built with Express and TypeScript. In-memory storage — no database.

## Key Files

- `src/auth/auth-service.ts` — Core auth logic: register, login, refresh, logout, password change, email update, account delete
- `src/auth/token.ts` — JWT generation, verification, revocation blacklist
- `src/auth/password.ts` — bcrypt hashing (12 rounds), password strength validation
- `src/auth/errors.ts` — `AuthError` class, `AuthErrorCode` union type
- `src/auth/types.ts` — Shared interfaces: `User`, `AuthTokens`, `TokenPayload`, `RegisterInput`, `LoginInput`
- `src/api/app.ts` — Express app factory, `AuthService` interface
- `src/api/auth-router.ts` — Route handlers, `ERROR_STATUS_MAP` for error-to-status mapping
- `src/api/middleware.ts` — `authenticateToken` middleware, request logger
- `src/api/rate-limiter.ts` — Per-IP sliding window rate limiter
- `src/api/validation.ts` — Zod schemas for request body validation
- `src/server.ts` — Entry point, wires auth-service into Express app

## Commands

- Build: `npm run build`
- Test: `npm test`
- Test with coverage: `npm run test:coverage`
- Dev server: `PORT=5001 npx ts-node src/server.ts`

## Important Patterns

- All auth logic lives in `src/auth/` — the API layer consumes it via the `AuthService` interface in `app.ts`. Never put auth business logic in the router.
- Add new error codes to the `AuthErrorCode` union in `errors.ts` AND to `ERROR_STATUS_MAP` in `auth-router.ts`.
- Zod schemas for all new input validation go in `src/api/validation.ts`.
- In tests, always call `clearRevokedTokens()`, `clearLoginAttempts()`, and `clearUserTokens()` in `afterEach` for isolation. Also call `clearRateLimitWindows()` if testing API routes.
- Never add a real database or email service without abstracting behind an interface first.
- Passwords must be >= 8 chars with at least one letter and one digit.
- Access tokens expire in 15 minutes, refresh tokens in 7 days.
- Refresh token rotation: every refresh revokes the old token and issues a new pair.
