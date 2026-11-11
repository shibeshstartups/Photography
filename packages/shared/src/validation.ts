import { z } from "zod";

/** Re-export zod for consumers. */
export { z };

/** A UUID v4 string. */
export const UuidSchema = z.string().uuid();

/** ISO date string (YYYY-MM-DD). */
export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

/** Time string HH:MM (24h). */
export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM");

/** Positive integer. */
export const PositiveIntSchema = z.number().int().positive();

/** Non-negative integer. */
export const NonNegativeIntSchema = z.number().int().nonnegative();

/** Money amount in smallest currency unit (e.g. paise / cents). */
export const MoneySchema = z.number().int().nonnegative();

/** Email. */
export const EmailSchema = z.string().email();

/** Phone — accept common formats. */
export const PhoneSchema = z.string().min(7).max(20);

/** A non-empty, trimmed string. */
export const NonEmptyStringSchema = z.string().trim().min(1);

/** Optional nullable string. */
export const OptionalStringSchema = z.string().trim().nullable().optional();

/** Pagination cursor (opaque base64url JSON). */
export const CursorSchema = z.string().min(1);

/** Date range filter. */
export const DateRangeSchema = z.object({
  from: DateSchema.optional(),
  to: DateSchema.optional(),
});

/** Pagination request. */
export const PaginationSchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.number().int().positive().max(200).default(50),
});

export type Pagination = z.infer<typeof PaginationSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;