import { z } from 'zod';
import {
  MESSAGE_MAX_LENGTH,
  NAME_MAX,
  NAME_MIN,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from './constants';

const name = z.string().trim().min(NAME_MIN).max(NAME_MAX);

/** Apelido único: minúsculas, números e _ (é como os amigos te encontram). */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN)
  .max(USERNAME_MAX)
  .regex(/^[a-z0-9_]+$/, 'Use apenas letras, números e _');

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const newPassword = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

export const registerSchema = z.object({
  name,
  username: usernameSchema,
  email,
  password: newPassword,
});
export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(PASSWORD_MAX),
});
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: newPassword,
});
export const changePasswordSchema = z.object({
  current: z.string().min(1).max(PASSWORD_MAX),
  next: newPassword,
});
export const updateProfileSchema = z.object({ name });

export const friendRequestSchema = z.object({ username: usernameSchema });
export const userSearchSchema = z.object({ q: z.string().trim().min(2).max(USERNAME_MAX) });

export const sendMessageSchema = z.object({
  to: z.uuid(),
  text: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
});
export const messageHistorySchema = z.object({
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
