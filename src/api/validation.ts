import { z } from "zod";
import type { Response } from "express";

export const RegisterSchema = z.object({
  email: z.string().min(1, "email is required"),
  password: z.string().min(1, "password is required"),
});

export const LoginSchema = z.object({
  email: z.string().min(1, "email is required"),
  password: z.string().min(1, "password is required"),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export const LogoutSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  newPassword: z.string().min(1, "newPassword is required"),
});

export const UpdateEmailSchema = z.object({
  newEmail: z.string().min(1, "newEmail is required"),
  password: z.string().min(1, "password is required"),
});

export const DeleteAccountSchema = z.object({
  password: z.string().min(1, "password is required"),
});

export function zodError(res: Response, err: z.ZodError): void {
  const message = err.issues.map((e) => e.message).join(", ");
  res.status(400).json({ error: { code: "INVALID_INPUT", message } });
}
