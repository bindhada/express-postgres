import { z } from "zod";

export const bookSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "A book needs a title")
    .max(100, "Title must be at most 100 characters"),
  genre: z
    .string()
    .max(50, "Genre must be at most 50 characters")
    .optional(),
  published_year: z
    .number()
    .int("Published year must be a whole number")
    .min(1000, "Published year must be at least 1000")
    .max(2100, "Published year must not exceed 2100"),
  author_id: z.number().int().positive().nullable().optional(),
});

export type BookInput = z.infer<typeof bookSchema>;
export type Book = BookInput & { id: number };

export const bookPatchSchema = bookSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided",
  );

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const bookQuerySchema = z.object({
  genre: z.string().optional(),
  search: z.string().optional(),
  sort: z
    .enum(["id", "title", "genre", "published_year", "author_id"])
    .default("id"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export type BookQuery = z.infer<typeof bookQuerySchema>;

export const authorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Author name must be at least 2 characters")
    .max(50, "Author name must be at most 50 characters"),
});

export type AuthorInput = z.infer<typeof authorSchema>;
export type Author = AuthorInput & { id: number };

export const memberSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().toLowerCase(),
});

export type MemberInput = z.infer<typeof memberSchema>;
export type Member = MemberInput & { id: number };

export const loanSchema = z.object({
  book_id: z.number().int().positive(),
  member_id: z.number().int().positive(),
});

export type LoanInput = z.infer<typeof loanSchema>;
export type Loan = LoanInput & {
  id: number;
  loan_date: string;
  return_date: string | null;
};