
import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "./db.js";

// Accept only categories supported by the application.
const categorySchema = z.object({
  category: z.enum([
    "Gifts",
    "Food & Drink",
    "Accessories",
  ]),
});

export async function getProducts(
  req: Request,
  res: Response,
) {
  const parsed = categorySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid category",
    });
  }

  const { category } = parsed.data;

  // SECURITY: $1 passes category as data, separate from SQL syntax.
  // SQL syntax inside the value cannot change the query structure.
  // Concatenation is unsafe because input can alter the SQL statement.
  const result = await pool.query(
    `SELECT name, description
     FROM products
     WHERE category = $1
       AND released = 1`,
    [category],
  );

  return res.json(result.rows);
}

// NOTE: $1 cannot parameterize identifiers such as column names or
// ORDER BY directions. Use a whitelist of trusted, hard-coded identifiers
// if the application needs dynamic sorting.