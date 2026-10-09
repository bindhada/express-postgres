
import express from "express";
import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

// --------------------------------------------------
// HOME
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the Library API",
    routes: [
      "GET /books",
      "GET /books/:id",
      "POST /books",
      "PUT /books/:id",
      "PATCH /books/:id",
      "DELETE /books/:id",
      "GET /authors",
      "POST /authors",
      "GET /authors/:id/books",
      "POST /members",
      "POST /loans",
      "PATCH /loans/:id/return",
      "GET /members/:id/loans",
      "GET /stats",
    ],
  });
});

// --------------------------------------------------
// HELPER: VALIDATE IDS
// --------------------------------------------------

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

// --------------------------------------------------
// EXERCISE 1, 2, 3, 4, 8: GET ALL BOOKS
// Supports genre, sort, search, page and limit
// --------------------------------------------------

app.get("/books", async (req, res) => {
  try {
    const allowedSorts = ["title", "published_year", "genre"];

    const genre = req.query.genre;
    const search = req.query.search;
    const sort = req.query.sort;
    const pageValue = req.query.page ?? "1";
    const limitValue = req.query.limit ?? "10";

    if (
      (genre !== undefined && typeof genre !== "string") ||
      (search !== undefined && typeof search !== "string") ||
      (sort !== undefined && typeof sort !== "string")
    ) {
      return res.status(400).json({
        error: "Invalid query parameters",
      });
    }

    if (sort && !allowedSorts.includes(sort)) {
      return res.status(400).json({
        error: "Invalid sort column",
        allowedSorts,
      });
    }

    if (
      !/^[1-9]\d*$/.test(String(pageValue)) ||
      !/^[1-9]\d*$/.test(String(limitValue))
    ) {
      return res.status(400).json({
        error: "Page and limit must be positive integers",
      });
    }

    const page = Number(pageValue);
    const limit = Number(limitValue);

    if (limit > 100) {
      return res.status(400).json({
        error: "Limit cannot exceed 100",
      });
    }

    const conditions = [];
    const values = [];

    if (genre) {
      values.push(genre);
      conditions.push(`b.genre = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`b.title ILIKE $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // Count matching books before pagination.
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM books b
       ${whereClause}`,
      values
    );

    const total = countResult.rows[0].total;
    const offset = (page - 1) * limit;

    const orderClause = sort
      ? `ORDER BY b.${sort} ASC NULLS LAST`
      : "ORDER BY b.id ASC";

    const queryValues = [...values, limit, offset];

    const result = await pool.query(
      `SELECT b.*, a.name AS author_name
       FROM books b
       LEFT JOIN authors a ON b.author_id = a.id
       ${whereClause}
       ${orderClause}
       LIMIT $${queryValues.length - 1}
       OFFSET $${queryValues.length}`,
      queryValues
    );

    res.status(200).json({
      page,
      limit,
      total,
      data: result.rows,
    });
  } catch (err) {
    console.error("GET /books:", err.message);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// --------------------------------------------------
// EXERCISE 1: GET ONE BOOK
// --------------------------------------------------

app.get("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    const result = await pool.query(
      `SELECT b.*, a.name AS author_name
       FROM books b
       LEFT JOIN authors a ON b.author_id = a.id
       WHERE b.id = $1`,
      [Number(id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("GET /books/:id:", err.message);
    res.status(500).json({ error: "Failed to fetch book" });
  }
});

// --------------------------------------------------
// EXERCISE 2, 6: CREATE BOOK
// --------------------------------------------------

app.post("/books", async (req, res) => {
  try {
    const { title, genre, published_year, author_id } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "Title is required",
      });
    }

    if (title.trim().length > 100) {
      return res.status(400).json({
        error: "Title cannot exceed 100 characters",
      });
    }

    if (
      genre !== undefined &&
      genre !== null &&
      (typeof genre !== "string" || genre.length > 50)
    ) {
      return res.status(400).json({
        error: "Genre must be a string of at most 50 characters",
      });
    }

    if (
      published_year !== undefined &&
      published_year !== null &&
      (!Number.isInteger(Number(published_year)) ||
        String(published_year).trim() === "")
    ) {
      return res.status(400).json({
        error: "Published year must be a whole number",
      });
    }

    if (
      author_id !== undefined &&
      author_id !== null &&
      !validId(author_id)
    ) {
      return res.status(400).json({
        error: "Author ID must be a positive integer",
      });
    }

    const result = await pool.query(
      `INSERT INTO books (title, genre, published_year, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        title.trim(),
        genre ?? null,
        published_year == null ? null : Number(published_year),
        author_id == null ? null : Number(author_id),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /books:", err.message);

    if (err.code === "23503") {
      return res.status(400).json({
        error: "The specified author does not exist",
      });
    }

    res.status(500).json({ error: "Failed to create book" });
  }
});

// --------------------------------------------------
// EXERCISE 3: PUT BOOK (FULL UPDATE)
// --------------------------------------------------

app.put("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, genre, published_year, author_id } = req.body;

    if (!validId(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (
      genre !== undefined &&
      genre !== null &&
      typeof genre !== "string"
    ) {
      return res.status(400).json({ error: "Invalid genre" });
    }

    if (
      published_year !== undefined &&
      published_year !== null &&
      !Number.isInteger(Number(published_year))
    ) {
      return res.status(400).json({ error: "Invalid published year" });
    }

    if (author_id != null && !validId(author_id)) {
      return res.status(400).json({ error: "Invalid author ID" });
    }

    const result = await pool.query(
      `UPDATE books
       SET title = $1,
           genre = $2,
           published_year = $3,
           author_id = $4
       WHERE id = $5
       RETURNING *`,
      [
        title.trim(),
        genre ?? null,
        published_year == null ? null : Number(published_year),
        author_id == null ? null : Number(author_id),
        Number(id),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("PUT /books/:id:", err.message);

    if (err.code === "23503") {
      return res.status(400).json({
        error: "The specified author does not exist",
      });
    }

    res.status(500).json({ error: "Failed to update book" });
  }
});

// --------------------------------------------------
// EXERCISE 5: PATCH BOOK (PARTIAL UPDATE)
// --------------------------------------------------

app.patch("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    const { title, genre, published_year, author_id } = req.body;

    const suppliedFields = [
      "title",
      "genre",
      "published_year",
      "author_id",
    ];

    if (!suppliedFields.some((field) =>
      Object.prototype.hasOwnProperty.call(req.body, field)
    )) {
      return res.status(400).json({
        error: "Provide at least one field to update",
      });
    }

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim())
    ) {
      return res.status(400).json({ error: "Invalid title" });
    }

    if (
      genre !== undefined &&
      genre !== null &&
      typeof genre !== "string"
    ) {
      return res.status(400).json({ error: "Invalid genre" });
    }

    if (
      published_year !== undefined &&
      published_year !== null &&
      !Number.isInteger(Number(published_year))
    ) {
      return res.status(400).json({
        error: "Invalid published year",
      });
    }

    if (author_id != null && !validId(author_id)) {
      return res.status(400).json({ error: "Invalid author ID" });
    }

    const result = await pool.query(
      `UPDATE books
       SET title = COALESCE($1, title),
           genre = COALESCE($2, genre),
           published_year = COALESCE($3, published_year),
           author_id = COALESCE($4, author_id)
       WHERE id = $5
       RETURNING *`,
      [
        title === undefined ? null : title.trim(),
        genre === undefined ? null : genre,
        published_year == null ? null : Number(published_year),
        author_id == null ? null : Number(author_id),
        Number(id),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /books/:id:", err.message);

    if (err.code === "23503") {
      return res.status(400).json({
        error: "The specified author does not exist",
      });
    }

    res.status(500).json({ error: "Failed to update book" });
  }
});

// --------------------------------------------------
// EXERCISE 3: DELETE BOOK
// --------------------------------------------------

app.delete("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    const result = await pool.query(
      "DELETE FROM books WHERE id = $1 RETURNING *",
      [Number(id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.status(200).json({
      message: "Book deleted successfully",
      book: result.rows[0],
    });
  } catch (err) {
    console.error("DELETE /books/:id:", err.message);

    if (err.code === "23503") {
      return res.status(409).json({
        error: "This book has related records and cannot be deleted",
      });
    }

    res.status(500).json({ error: "Failed to delete book" });
  }
});

// --------------------------------------------------
// EXERCISE 6: GET AUTHORS
// --------------------------------------------------

app.get("/authors", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM authors ORDER BY id"
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("GET /authors:", err.message);
    res.status(500).json({ error: "Failed to fetch authors" });
  }
});

// --------------------------------------------------
// EXERCISE 6: CREATE AUTHOR
// --------------------------------------------------

app.post("/authors", async (req, res) => {
  try {
    const { name } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "Author name is required",
      });
    }

    const result = await pool.query(
      `INSERT INTO authors (name)
       VALUES ($1)
       RETURNING *`,
      [name.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /authors:", err.message);
    res.status(500).json({ error: "Failed to create author" });
  }
});

// --------------------------------------------------
// EXERCISE 6: GET BOOKS BY AUTHOR
// --------------------------------------------------

app.get("/authors/:id/books", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({ error: "Invalid author ID" });
    }

    const result = await pool.query(
      `SELECT b.*, a.name AS author_name
       FROM books b
       JOIN authors a ON b.author_id = a.id
       WHERE a.id = $1
       ORDER BY b.id`,
      [Number(id)]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("GET /authors/:id/books:", err.message);
    res.status(500).json({
      error: "Failed to fetch books by author",
    });
  }
});

// --------------------------------------------------
// EXERCISE 7: CREATE MEMBER
// --------------------------------------------------

app.post("/members", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Member name is required" });
    }

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Member email is required" });
    }

    const result = await pool.query(
      `INSERT INTO members (name, email)
       VALUES ($1, $2)
       RETURNING *`,
      [name.trim(), email.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /members:", err.message);

    if (err.code === "23505") {
      return res.status(409).json({
        error: "A member with this email already exists",
      });
    }

    res.status(500).json({ error: "Failed to create member" });
  }
});

// --------------------------------------------------
// EXERCISE 7: CREATE LOAN
// Transaction prevents simultaneous active loans
// for the same book.
// --------------------------------------------------

app.post("/loans", async (req, res) => {
  const client = await pool.connect();

  try {
    const { book_id, member_id } = req.body;

    if (!validId(book_id) || !validId(member_id)) {
      return res.status(400).json({
        error: "Valid book_id and member_id are required",
      });
    }

    await client.query("BEGIN");

    const book = await client.query(
      "SELECT id FROM books WHERE id = $1 FOR UPDATE",
      [Number(book_id)]
    );

    if (book.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Book does not exist" });
    }

    const member = await client.query(
      "SELECT id FROM members WHERE id = $1",
      [Number(member_id)]
    );

    if (member.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Member does not exist" });
    }

    const activeLoan = await client.query(
      `SELECT id FROM loans
       WHERE book_id = $1 AND returned_at IS NULL`,
      [Number(book_id)]
    );

    if (activeLoan.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "This book is already borrowed",
      });
    }

    const result = await client.query(
      `INSERT INTO loans (book_id, member_id)
       VALUES ($1, $2)
       RETURNING *`,
      [Number(book_id), Number(member_id)]
    );

    await client.query("COMMIT");

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /loans:", err.message);

    if (err.code === "23503") {
      return res.status(400).json({
        error: "The specified book or member does not exist",
      });
    }

    res.status(500).json({ error: "Failed to create loan" });
  } finally {
    client.release();
  }
});

// --------------------------------------------------
// EXERCISE 7: RETURN BOOK
// --------------------------------------------------

app.patch("/loans/:id/return", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({ error: "Invalid loan ID" });
    }

    const result = await pool.query(
      `UPDATE loans
       SET returned_at = NOW()
       WHERE id = $1 AND returned_at IS NULL
       RETURNING *`,
      [Number(id)]
    );

    if (result.rowCount === 0) {
      const existing = await pool.query(
        "SELECT id, returned_at FROM loans WHERE id = $1",
        [Number(id)]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({ error: "Loan not found" });
      }

      return res.status(409).json({
        error: "This loan has already been returned",
      });
    }

    res.status(200).json({
      message: "Book returned successfully",
      loan: result.rows[0],
    });
  } catch (err) {
    console.error("PATCH /loans/:id/return:", err.message);
    res.status(500).json({ error: "Failed to return book" });
  }
});

// --------------------------------------------------
// EXERCISE 7: GET MEMBER LOANS WITH BOOK TITLES
// --------------------------------------------------

app.get("/members/:id/loans", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({ error: "Invalid member ID" });
    }

    const member = await pool.query(
      "SELECT id FROM members WHERE id = $1",
      [Number(id)]
    );

    if (member.rowCount === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    const result = await pool.query(
      `SELECT
         l.id AS loan_id,
         l.book_id,
         b.title AS book_title,
         l.member_id,
         m.name AS member_name,
         m.email AS member_email,
         l.borrowed_at,
         l.returned_at
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN members m ON l.member_id = m.id
       WHERE m.id = $1
       ORDER BY l.borrowed_at DESC`,
      [Number(id)]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("GET /members/:id/loans:", err.message);
    res.status(500).json({ error: "Failed to fetch member loans" });
  }
});

// --------------------------------------------------
// EXERCISE 8: STATISTICS
// --------------------------------------------------

app.get("/stats", async (req, res) => {
  try {
    const genreStats = await pool.query(
      `SELECT
         COALESCE(genre, 'Uncategorized') AS genre,
         COUNT(*)::int AS count
       FROM books
       GROUP BY genre
       ORDER BY count DESC, genre ASC`
    );

    const authorStats = await pool.query(
      `SELECT
         a.id,
         a.name,
         COUNT(b.id)::int AS book_count
       FROM authors a
       LEFT JOIN books b ON b.author_id = a.id
       GROUP BY a.id, a.name
       ORDER BY book_count DESC, a.name ASC
       LIMIT 1`
    );

    res.status(200).json({
      booksPerGenre: genreStats.rows,
      mostBooksAuthor: authorStats.rows[0] ?? null,
    });
  } catch (err) {
    console.error("GET /stats:", err.message);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// --------------------------------------------------
// UNKNOWN ROUTES
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error("Unexpected server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({ error: "Internal server error" });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`Library API running at http://localhost:${PORT}`);
});