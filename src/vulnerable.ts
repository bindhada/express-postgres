
import type { Request, Response } from "express";
import { pool } from "./db.js";

// INTENTIONALLY VULNERABLE — for homework demonstration only.
// Never use string concatenation to insert user input into SQL.
export async function getProducts(
  req: Request,
  res: Response,
) {
  const result = await pool.query(
    `SELECT name, description FROM products WHERE category = '${req.query.category}' AND released = 1`,
  );

  return res.json(result.rows);
}