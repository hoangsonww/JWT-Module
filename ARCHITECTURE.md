# Architecture

Detailed architecture documentation for jwt-module.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Module Dependency Graph](#module-dependency-graph)
- [Data Model](#data-model)
- [Request Lifecycle](#request-lifecycle)
- [Token Lifecycle](#token-lifecycle)
- [Security Architecture](#security-architecture)
- [Authentication State Machine](#authentication-state-machine)
- [Error Handling Architecture](#error-handling-architecture)
- [Configuration](#configuration)
- [File Structure](#file-structure)
- [Design Decisions](#design-decisions)
- [Known Limitations](#known-limitations)
- [Extension Points](#extension-points)

---

## System Architecture

The system follows a layered architecture with clear separation between the HTTP transport layer and the core authentication logic.

```mermaid
graph TB
    subgraph Client Layer
        CL([Client / Browser / cURL])
    end

    subgraph API Layer
        MW[Middleware<br/>Helmet, CORS, Logger, Body Parser]
        RL[Rate Limiter<br/>Per-IP sliding window]
        RT[Auth Router<br/>Route handlers, error mapping]
        VAL[Validation<br/>Zod schemas]
    end

    subgraph Auth Core
        AS[Auth Service<br/>register, login, refresh,<br/>logout, password, email, delete]
        TS[Token Service<br/>generate, verify,<br/>revoke, prune]
        PS[Password Service<br/>hash, verify, validate strength]
        ERR[Error Types<br/>AuthError, AuthErrorCode]
    end

    subgraph Storage Layer
        UM[(Users Map<br/>id -> User)]
        TB[(Token Blacklist<br/>token -> expiry)]
        LA[(Login Attempts<br/>email -> LockoutEntry)]
        UT[(User Tokens<br/>userId -> Set of tokens)]
        RW[(Rate Windows<br/>ip -> WindowEntry)]
    end

    CL -->|HTTP| MW
    MW --> RL
    RL --> RT
    RT --> VAL
    RT --> AS
    AS --> TS
    AS --> PS
    AS --> ERR
    TS --> ERR
    PS --> ERR
    AS --> UM
    AS --> LA
    AS --> UT
    TS --> TB
    RL --> RW

    style CL fill:#e1f5fe
    style MW fill:#fff3e0
    style RL fill:#fff3e0
    style RT fill:#fff3e0
    style VAL fill:#fff3e0
    style AS fill:#e8f5e9
    style TS fill:#e8f5e9
    style PS fill:#e8f5e9
    style ERR fill:#e8f5e9
    style UM fill:#fce4ec
    style TB fill:#fce4ec
    style LA fill:#fce4ec
    style UT fill:#fce4ec
    style RW fill:#fce4ec
```

---

## Module Dependency Graph

Import relationships between all source modules:

```mermaid
graph TD
    SERVER[server.ts] --> APP[api/app.ts]
    SERVER --> AUTH_SVC[auth/auth-service.ts]
    SERVER --> EXPRESS_STATIC[express.static]

    APP --> AUTH_ROUTER[api/auth-router.ts]
    APP --> MW[api/middleware.ts]
    APP --> TYPES[auth/types.ts]

    AUTH_ROUTER --> ERRORS[auth/errors.ts]
    AUTH_ROUTER --> APP
    AUTH_ROUTER --> MW
    AUTH_ROUTER --> RATE[api/rate-limiter.ts]
    AUTH_ROUTER --> VALID[api/validation.ts]

    MW --> TOKEN[auth/token.ts]
    MW --> TYPES
    MW --> ERRORS

    AUTH_SVC --> ERRORS
    AUTH_SVC --> PASSWORD[auth/password.ts]
    AUTH_SVC --> TOKEN
    AUTH_SVC --> TYPES

    TOKEN --> ERRORS
    TOKEN --> TYPES

    PASSWORD --> ERRORS

    INDEX[auth/index.ts] --> ERRORS
    INDEX --> PASSWORD
    INDEX --> TOKEN
    INDEX --> AUTH_SVC
    INDEX --> TYPES

    VALID --> ZOD[zod]
    TOKEN --> JWT[jsonwebtoken]
    PASSWORD --> BCRYPT[bcrypt]
    AUTH_SVC --> CUID2["@paralleldrive/cuid2"]

    style SERVER fill:#e3f2fd
    style APP fill:#fff3e0
    style AUTH_ROUTER fill:#fff3e0
    style MW fill:#fff3e0
    style RATE fill:#fff3e0
    style VALID fill:#fff3e0
    style AUTH_SVC fill:#e8f5e9
    style TOKEN fill:#e8f5e9
    style PASSWORD fill:#e8f5e9
    style ERRORS fill:#e8f5e9
    style TYPES fill:#e8f5e9
    style INDEX fill:#e8f5e9
    style ZOD fill:#f3e5f5
    style JWT fill:#f3e5f5
    style BCRYPT fill:#f3e5f5
    style CUID2 fill:#f3e5f5
```

---

## Data Model

```mermaid
erDiagram
    USER {
        string id PK "CUID2"
        string email UK "lowercase, trimmed"
        string passwordHash "bcrypt, 12 rounds"
        Date createdAt "registration timestamp"
    }

    ACCESS_TOKEN {
        string jwt "HS256 signed"
        string userId FK
        string email
        datetime exp "15 minutes from issue"
    }

    REFRESH_TOKEN {
        string jwt "HS256 signed"
        string userId FK
        string email
        datetime exp "7 days from issue"
    }

    REVOKED_TOKEN {
        string token PK "full JWT string"
        number expiresAt "Date.now() + 7d TTL"
    }

    LOCKOUT_ENTRY {
        string email PK
        number count "failed attempts"
        number lockedUntil "null or unlock timestamp"
    }

    RATE_WINDOW {
        string ip PK "client IP"
        number count "requests in window"
        number resetAt "window expiry timestamp"
    }

    USER_TOKENS {
        string userId PK
        set refreshTokens "active refresh tokens"
    }

    USER ||--o{ ACCESS_TOKEN : "issued"
    USER ||--o{ REFRESH_TOKEN : "issued"
    REFRESH_TOKEN ||--o| REVOKED_TOKEN : "revoked into"
    USER ||--|| USER_TOKENS : "tracks"
    USER_TOKENS ||--o{ REFRESH_TOKEN : "contains"
    USER ||--o| LOCKOUT_ENTRY : "tracks failures"
```

---

## Request Lifecycle

Detailed sequence diagram for an authenticated request (e.g., `POST /auth/change-password`):

```mermaid
sequenceDiagram
    participant C as Client
    participant H as Helmet
    participant CO as CORS
    participant L as Logger
    participant BP as Body Parser
    participant R as Router
    participant A as Auth Middleware
    participant RL as Rate Limiter
    participant Z as Zod Validation
    participant S as Auth Service
    participant P as Password Service
    participant T as Token Service

    C->>H: POST /auth/change-password
    H->>H: Set security headers
    H->>CO: Pass through
    CO->>CO: Check origin against CORS_ORIGIN
    CO->>L: Pass through
    L->>L: Start timer
    L->>BP: Pass through
    BP->>BP: Parse JSON (max 10kb)
    BP->>R: Route match

    R->>A: authenticateToken middleware
    A->>A: Extract Bearer token from header
    A->>T: verifyAccessToken(token)
    T->>T: Check JWT_ACCESS_SECRET env var
    T->>T: jwt.verify(token, secret, {algorithms: ["HS256"]})
    T-->>A: TokenPayload {userId, email}
    A->>A: Set req.user = payload

    A->>RL: rateLimiter middleware
    RL->>RL: Get IP from x-forwarded-for or req.ip
    RL->>RL: Check window: count < 20?
    RL-->>R: next()

    R->>Z: ChangePasswordSchema.safeParse(body)
    Z-->>R: {currentPassword, newPassword}

    R->>S: changePassword(userId, current, new)
    S->>S: users.get(userId)
    S->>P: verifyPassword(current, hash)
    P->>P: bcrypt.compare()
    P-->>S: true
    S->>P: validatePasswordStrength(new)
    P-->>S: passes
    S->>P: hashPassword(new)
    P->>P: bcrypt.hash(new, 12)
    P-->>S: newHash
    S->>S: user.passwordHash = newHash
    S->>T: revokeAllUserTokens(userId)
    T->>T: Add all tokens to blacklist
    S-->>R: void

    R-->>C: 200 {message: "Password changed successfully"}
    L->>L: Log "POST /auth/change-password 200 45ms"
```

---

## Token Lifecycle

```mermaid
flowchart TD
    GEN[Token Generation] -->|generateTokens| PAIR[Access + Refresh Pair]
    PAIR --> AT[Access Token<br/>15 min TTL]
    PAIR --> RT[Refresh Token<br/>7 day TTL]

    AT -->|Used in| AUTH[Authorization Header]
    AUTH -->|verifyAccessToken| VALID{Valid?}
    VALID -->|Yes| ACCESS[Access Granted]
    VALID -->|Expired| EXPIRED[401 TOKEN_EXPIRED]
    VALID -->|Invalid| INVALID[401 INVALID_TOKEN]

    RT -->|POST /auth/refresh| ROTATE[Refresh Rotation]
    ROTATE -->|1| REVOKE[Revoke Old Token]
    ROTATE -->|2| NEW[Generate New Pair]
    REVOKE --> BLACKLIST[Token Blacklist<br/>7-day TTL entry]

    RT -->|POST /auth/logout| SINGLE[Single Revocation]
    SINGLE --> BLACKLIST

    RT -->|POST /auth/logout-all| ALL[Revoke All User Tokens]
    ALL --> BLACKLIST

    BLACKLIST -->|pruneExpiredTokens| PRUNE[Remove entries<br/>past TTL expiry]

    style GEN fill:#e8f5e9
    style AT fill:#e3f2fd
    style RT fill:#e3f2fd
    style BLACKLIST fill:#ffcdd2
    style PRUNE fill:#fff3e0
```

### Token Lifecycle Summary

1. **Generation** -- `generateTokens()` creates an access/refresh pair signed with HS256
2. **Registration** -- Refresh token is tracked per-user in the `userTokens` map
3. **Usage** -- Access token is sent as `Bearer` header, verified by middleware
4. **Rotation** -- On refresh, old token is revoked (blacklisted) and removed from user tracking; new pair is issued
5. **Revocation** -- Tokens are added to `revokedTokens` map with a 7-day TTL
6. **Expiry** -- JWT library rejects tokens past their `exp` claim
7. **Pruning** -- `pruneExpiredTokens()` removes blacklist entries past their TTL to prevent memory growth

---

## Security Architecture

Defense-in-depth with five security layers:

```mermaid
graph TB
    subgraph "Layer 1: Transport Security"
        L1A[Helmet - security headers]
        L1B[CORS - origin restriction]
        L1C[Body size limit - 10kb]
    end

    subgraph "Layer 2: Rate Control"
        L2A[Per-IP sliding window<br/>20 req / 15 min]
    end

    subgraph "Layer 3: Input Validation"
        L3A[Zod schema validation<br/>on all request bodies]
    end

    subgraph "Layer 4: Authentication"
        L4A[JWT HS256 with algorithm pinning]
        L4B[Bearer token middleware]
        L4C[Token blacklist check]
    end

    subgraph "Layer 5: Authorization & Business Rules"
        L5A[Account lockout<br/>5 attempts / 15 min]
        L5B[Password verification<br/>for sensitive operations]
        L5C[bcrypt hashing - 12 rounds]
        L5D[Refresh token rotation]
    end

    L1A --> L1B --> L1C --> L2A --> L3A --> L4A
    L4A --> L4B --> L4C --> L5A --> L5B --> L5C --> L5D

    style L1A fill:#e3f2fd
    style L1B fill:#e3f2fd
    style L1C fill:#e3f2fd
    style L2A fill:#fff3e0
    style L3A fill:#e8f5e9
    style L4A fill:#f3e5f5
    style L4B fill:#f3e5f5
    style L4C fill:#f3e5f5
    style L5A fill:#ffcdd2
    style L5B fill:#ffcdd2
    style L5C fill:#ffcdd2
    style L5D fill:#ffcdd2
```

---

## Authentication State Machine

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated

    Unauthenticated --> Registered: POST /auth/register
    Registered --> Authenticated: Tokens issued

    Unauthenticated --> Authenticated: POST /auth/login (success)
    Unauthenticated --> FailedAttempt: POST /auth/login (wrong password)

    FailedAttempt --> Unauthenticated: count < 5
    FailedAttempt --> Locked: count >= 5

    Locked --> Unauthenticated: 15 min elapsed

    Authenticated --> TokenExpired: Access token expires (15 min)
    TokenExpired --> Authenticated: POST /auth/refresh (rotation)
    TokenExpired --> Unauthenticated: Refresh token expired (7 days)

    Authenticated --> Unauthenticated: POST /auth/logout
    Authenticated --> Unauthenticated: POST /auth/logout-all
    Authenticated --> Unauthenticated: POST /auth/change-password (all sessions revoked)
    Authenticated --> Unauthenticated: DELETE /auth/me (account deleted)
```

---

## Error Handling Architecture

```mermaid
flowchart TD
    REQ[Route Handler] --> TRY{try/catch}

    TRY -->|AuthError thrown| CHECK{instanceof AuthError?}
    TRY -->|Unknown error| INTERNAL[500 INTERNAL_ERROR]

    CHECK -->|Yes| MAP[ERROR_STATUS_MAP lookup]
    CHECK -->|No| INTERNAL

    MAP --> STATUS[Map error code to HTTP status]

    STATUS --> RES[JSON response:<br/>status + error.code + error.message]
    INTERNAL --> RES

    subgraph Error Codes
        E1[DUPLICATE_EMAIL -> 409]
        E2[INVALID_CREDENTIALS -> 401]
        E3[INVALID_TOKEN -> 401]
        E4[TOKEN_EXPIRED -> 401]
        E5[MISSING_SECRET -> 500]
        E6[INVALID_EMAIL -> 400]
        E7[WEAK_PASSWORD -> 400]
        E8[USER_NOT_FOUND -> 404]
        E9[MISSING_TOKEN -> 401]
        E10[ACCOUNT_LOCKED -> 423]
    end

    MAP -.-> E1
    MAP -.-> E2
    MAP -.-> E3
    MAP -.-> E4
    MAP -.-> E5
    MAP -.-> E6
    MAP -.-> E7
    MAP -.-> E8
    MAP -.-> E9
    MAP -.-> E10

    subgraph Zod Validation
        ZOD[safeParse fails] --> ZERR[400 INVALID_INPUT<br/>joined issue messages]
    end

    style REQ fill:#e3f2fd
    style RES fill:#c8e6c9
    style INTERNAL fill:#ffcdd2
```

**Error flow:**
1. Zod validation failures are caught before the auth service is invoked, returning `400 INVALID_INPUT`
2. Auth service functions throw `AuthError` with a typed `code` property
3. `handleAuthError()` in the router maps `AuthError.code` to an HTTP status via `ERROR_STATUS_MAP`
4. Unknown errors produce `500 INTERNAL_ERROR` with a generic message (no internal details leaked)

---

## Configuration

All configurable values in the system:

| Parameter | Location | Value | Configurable Via |
|---|---|---|---|
| Access token TTL | `token.ts` | 15 minutes | Code constant |
| Refresh token TTL | `token.ts` | 7 days | Code constant |
| Revocation blacklist TTL | `token.ts` | 7 days | Code constant |
| JWT algorithm | `token.ts` | HS256 | Code constant |
| bcrypt salt rounds | `password.ts` | 12 | Code constant |
| Password min length | `password.ts` | 8 | Code constant |
| Max login attempts | `auth-service.ts` | 5 | Code constant |
| Lockout duration | `auth-service.ts` | 15 minutes | Code constant |
| Rate limit window | `rate-limiter.ts` | 15 minutes | Code constant |
| Rate limit max requests | `rate-limiter.ts` | 20 | Code constant |
| Body size limit | `app.ts` | 10kb | Code constant |
| Server port | `server.ts` | 3000 | `PORT` env var |
| Access token secret | `token.ts` | -- | `JWT_ACCESS_SECRET` env var |
| Refresh token secret | `token.ts` | -- | `JWT_REFRESH_SECRET` env var |
| CORS origin | `app.ts` | `*` | `CORS_ORIGIN` env var |

---

## File Structure

```
jwt-module/
  src/
    auth/                          # Auth core -- framework-agnostic
      auth-service.ts              # Business logic: register, login, refresh, logout,
                                   #   changePassword, updateEmail, deleteAccount
                                   # In-memory stores: users, userTokens, loginAttempts
      errors.ts                    # AuthError class extending Error
                                   # AuthErrorCode union type (10 codes)
      password.ts                  # hashPassword (bcrypt 12 rounds)
                                   # verifyPassword, validatePasswordStrength
      token.ts                     # generateTokens, generateAccessToken, generateRefreshToken
                                   # verifyAccessToken, verifyRefreshToken
                                   # revokeRefreshToken, pruneExpiredTokens
                                   # In-memory store: revokedTokens
      types.ts                     # User, TokenPayload, AuthTokens,
                                   #   RegisterInput, LoginInput
      index.ts                     # Barrel exports for all auth module exports
    api/                           # HTTP transport layer
      app.ts                       # createApp factory, AuthService interface
                                   # Helmet, CORS, body parser, router wiring
      auth-router.ts               # createAuthRouter with all 10 route handlers
                                   # ERROR_STATUS_MAP, handleAuthError
      middleware.ts                # authenticateToken (Bearer verification)
                                   # requestLogger (method, path, status, duration)
      rate-limiter.ts              # rateLimiter middleware (per-IP sliding window)
                                   # In-memory store: windows
      validation.ts                # Zod schemas: Register, Login, Refresh, Logout,
                                   #   ChangePassword, UpdateEmail, DeleteAccount
                                   # zodError helper
    server.ts                      # Entry point: env defaults, createApp, static UI, listen
  public/                          # Interactive test UI (static HTML)
  dist/                            # Compiled JavaScript output
```

---

## Design Decisions

### Why in-memory storage?

The module is designed for development, prototyping, and education. In-memory `Map` objects provide zero-config operation with no external dependencies. The `AuthService` interface in `app.ts` makes it straightforward to swap in a persistent store.

### Why bcrypt with 12 rounds?

bcrypt is the industry standard for password hashing. 12 rounds provides a good balance between security and performance (~250ms per hash). The adaptive cost factor means it can be increased as hardware improves.

### Why HS256 for JWT?

HS256 (HMAC-SHA256) is the simplest JWT algorithm that provides sufficient security for a single-service module. RS256 would be appropriate for distributed systems where token verification needs to happen without sharing the signing secret, but adds key management complexity.

### Why Zod for validation?

Zod provides TypeScript-first schema validation with excellent type inference. It validates and narrows types in a single step, reducing boilerplate compared to manual validation. The schemas serve as both runtime validators and documentation.

### Why a custom rate limiter?

A simple per-IP sliding window rate limiter avoids adding a dependency like `express-rate-limit` for ~35 lines of code. The in-memory approach matches the overall storage strategy. For production, this should be replaced with a Redis-backed solution.

### Why refresh token rotation?

Refresh token rotation limits the damage of a stolen refresh token. Each use of a refresh token invalidates it and issues a new one. If an attacker uses a stolen token, the legitimate user's next refresh will fail (because the token was already rotated), signaling a compromise.

### Why algorithm pinning on verification?

Passing `{ algorithms: ["HS256"] }` to `jwt.verify()` prevents algorithm substitution attacks where an attacker could change the algorithm header to `none` or use the public key as an HMAC secret.

---

## Known Limitations

1. **No persistence** -- All data is lost on process restart. The `Map`-based stores do not survive across deployments.
2. **Single-process only** -- In-memory stores are not shared across worker processes or containers. Horizontal scaling requires a shared store (Redis, database).
3. **No token pruning scheduler** -- `pruneExpiredTokens()` exists but is never called automatically. Without periodic pruning, the revocation blacklist grows until restart.
4. **No email verification** -- Registration does not verify email ownership. Any syntactically valid email is accepted.
5. **No password reset** -- There is no forgot-password or reset-password flow.
6. **No 2FA/MFA** -- Single-factor authentication only.
7. **Rate limiter per-process** -- Rate limit windows are not shared across processes.
8. **No audit logging** -- Login attempts, password changes, and account deletions are not logged to a persistent audit trail.
9. **No HTTPS enforcement** -- The server does not redirect HTTP to HTTPS or set HSTS (handled by a reverse proxy in production).

---

## Extension Points

### Adding a Database

1. Create a `UserRepository` interface with methods: `findById`, `findByEmail`, `create`, `update`, `delete`
2. Implement it for your database (PostgreSQL, MongoDB, etc.)
3. Refactor `auth-service.ts` to accept the repository via dependency injection instead of using the in-memory `Map`
4. The `AuthService` interface in `app.ts` stays unchanged -- the API layer is unaffected

### Adding Redis for Token Storage

1. Create a `TokenStore` interface with methods: `revoke`, `isRevoked`, `prune`
2. Implement it using Redis with TTL-based expiry (replaces manual pruning)
3. Create a `RateLimitStore` interface for the rate limiter
4. This also enables multi-process and multi-container deployments

### Adding Email Verification

1. Create an `EmailService` interface with a `sendVerificationEmail` method
2. Add a `verified: boolean` field to the `User` type
3. Add `UNVERIFIED_EMAIL` to `AuthErrorCode` and `ERROR_STATUS_MAP`
4. Generate a verification token on registration, send via email, verify on callback endpoint
5. Gate login behind `verified === true`

### Adding Two-Factor Authentication (2FA)

1. Add `totpSecret: string | null` and `twoFactorEnabled: boolean` to the `User` type
2. Create endpoints: `POST /auth/2fa/setup` (returns QR code), `POST /auth/2fa/verify` (confirms setup), `POST /auth/2fa/validate` (validates TOTP on login)
3. Modify the login flow to return a partial token that requires 2FA validation before issuing full access
4. Use a TOTP library like `otpauth` or `speakeasy`
