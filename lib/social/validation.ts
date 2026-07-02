import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])?$/, "username_invalid");

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  username: usernameSchema.optional(),
  bio: z.string().trim().max(280).optional().nullable(),
  avatarUrl: z.union([z.string().trim().url(), z.literal("")]).optional().nullable(),
  isProfilePrivate: z.boolean().optional(),
  showWatchedSeries: z.boolean().optional(),
  showWatchingSeries: z.boolean().optional(),
  showLists: z.boolean().optional(),
  showReviews: z.boolean().optional(),
  showActivity: z.boolean().optional()
});

export const listVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);

export const createListSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(280).optional().nullable(),
  visibility: listVisibilitySchema.optional()
});

export const updateListSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(280).optional().nullable(),
  visibility: listVisibilitySchema.optional()
});

export const addListItemSchema = z.object({
  seriesId: z.string().min(1),
  note: z.string().trim().max(280).optional().nullable()
});

export const reorderListItemSchema = z.object({
  direction: z.enum(["up", "down"])
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(2000),
  visibility: listVisibilitySchema.optional()
});
