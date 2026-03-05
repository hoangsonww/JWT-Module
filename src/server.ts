import path from "path";
import { createApp } from "./api/app";
import * as authService from "./auth/auth-service";

const PORT = process.env.PORT ?? 3000;

if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = "dev-access-secret-change-in-prod";
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = "dev-refresh-secret-change-in-prod";
}

const app = createApp(authService);

// Serve the interactive test UI
import express from "express";
app.use(express.static(path.join(__dirname, "..", "public")));

app.listen(PORT, () => {
  console.log(`JWT module running on http://localhost:${PORT}`);
  console.log("\nAuth endpoints:");
  console.log("  POST   /auth/register");
  console.log("  POST   /auth/login");
  console.log("  POST   /auth/refresh");
  console.log("  POST   /auth/logout");
  console.log("  POST   /auth/logout-all         (requires Bearer token)");
  console.log("  POST   /auth/change-password    (requires Bearer token)");
  console.log("  POST   /auth/forgot-password");
  console.log("  POST   /auth/reset-password");
  console.log("  GET    /auth/me                 (requires Bearer token)");
  console.log("  PATCH  /auth/me                 (requires Bearer token)");
  console.log("  DELETE /auth/me                 (requires Bearer token)");
  console.log("  GET    /auth/sessions            (requires Bearer token)");
  console.log("  DELETE /auth/sessions/:id        (requires Bearer token)");
  console.log("\nAdmin endpoints (requires X-Admin-Key header):");
  console.log("  GET    /admin/users");
  console.log("  GET    /admin/audit");
  console.log("  GET    /admin/stats");
  console.log("\nSystem:");
  console.log("  GET    /health");
  console.log(`\n  UI     http://localhost:${PORT}/`);
});
