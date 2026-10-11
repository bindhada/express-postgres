import express from "express";
import { pool } from "./db.js";
import { env } from "./env.js";
import {
  authorSchema,
  bookPatchSchema,
  bookQuerySchema,
  bookSchema,
  idParamSchema,
  loanSchema,
  memberSchema,
  type Author,
  type AuthorInput,
  type Book,
  type BookInput,
  type BookQuery,
  type Loan,
  type LoanInput,
  type Member,
  type MemberInput,
} from "./schemas.js";
import { validate } from "./middleware/validate.js";

const app = express();

app.use(express.json());

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

function handleDatabaseError(
  res: express.Response,
  err: unknown,
): void {
  const code =
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof err.code === "string"
      ? err.code
      : undefined;

  if (code === "23503") {
    res.status(400).json({
      error: "The referenced author, book, or member does not exist",
    });
    return;
  }

  if (code === "23505") {
    res.status(409).json({
      error: "A record with this unique value already exists",
    });
    return;
  }

  console.error("Database error:", getErrorMessage(err));
  res.status(500).json({ error: "Internal server error" });
}

// Health check
app.get("/", (_req, res) => {
  res.json({ message: "Library API is running" });
});

// -------------------- BOOKS --------------------

// List books, with filters, sorting, search, and pagination.
app.get(
  "/books",
  validate(bookQuerySchema, "query"),
  async (_req, res) => {
    const query = res.locals.validated as BookQuery;
    const values: (string | number)[] = [];
    const conditions: string[] = [];

    if (query.genre !== undefined) {
      values.push(query.genre);
      conditions.push(`genre = $${values.length}`);
    }

    if (query.search !== undefined) {
      values.push(`%${query.search}%`);
      conditions.push(`title ILIKE $${values.length}`);
    }

    const where =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    // query.sort is safe because Zod restricts it to an enum.
    const sort = query.sort;
    const offset = (query.page - 1) * query.limit;

    values.push(query.limit);
    const limitIndex = values.length;

    values.push(offset);
    const offsetIndex = values.length;

    try {
      const result = await pool.query<Book>(
        `SELECT id, title, genre, published_year, author_id
         FROM books
         ${where}
         ORDER BY ${sort}
         LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
        values,
      );

      res.json({
        data: result.rows,
        page: query.page,
        limit: query.limit,
      });
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

// Get one book
app.get(
  "/books/:id",
  validate(idParamSchema, "params"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };

    try {
      const result = await pool.query<Book>(
        "SELECT * FROM books WHERE id = $1",
        [id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Book not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

// Create book
app.post(
  "/books",
  validate(bookSchema, "body"),
  async (_req, res) => {
    const book = res.locals.validated as BookInput;

    try {
      const result = await pool.query<Book>(
        `INSERT INTO books
           (title, genre, published_year, author_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          book.title,
          book.genre ?? null,
          book.published_year,
          book.author_id ?? null,
        ],
      );

      res.status(201).json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

// Replace book fields
app.put(
  "/books/:id",
  validate(idParamSchema, "params"),
  validate(bookSchema, "body"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };
    const book = res.locals.validated as BookInput;

    try {
      const result = await pool.query<Book>(
        `UPDATE books
         SET title = $1, genre = $2, published_year = $3,
             author_id = $4
         WHERE id = $5
         RETURNING *`,
        [
          book.title,
          book.genre ?? null,
          book.published_year,
          book.author_id ?? null,
          id,
        ],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Book not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

// Partially update book
app.patch(
  "/books/:id",
  validate(idParamSchema, "params"),
  validate(bookPatchSchema, "body"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };
    const patch = res.locals.validated as Partial<BookInput>;

    const fields = Object.keys(patch) as (keyof BookInput)[];
    const values: unknown[] = [];
    const assignments = fields.map((field) => {
      values.push(patch[field] ?? null);
      return `${field} = $${values.length}`;
    });

    values.push(id);

    try {
      const result = await pool.query<Book>(
        `UPDATE books
         SET ${assignments.join(", ")}
         WHERE id = $${values.length}
         RETURNING *`,
        values,
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Book not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

// Delete book
app.delete(
  "/books/:id",
  validate(idParamSchema, "params"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };

    try {
      const result = await pool.query<Book>(
        "DELETE FROM books WHERE id = $1 RETURNING *",
        [id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Book not found" });
        return;
      }

      res.json({
        message: "Book deleted",
        book: result.rows[0],
      });
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

// -------------------- AUTHORS --------------------

app.get("/authors", async (_req, res) => {
  try {
    const result = await pool.query<Author>(
      "SELECT * FROM authors ORDER BY id",
    );
    res.json(result.rows);
  } catch (err: unknown) {
    handleDatabaseError(res, err);
  }
});

app.get(
  "/authors/:id",
  validate(idParamSchema, "params"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };

    try {
      const result = await pool.query<Author>(
        "SELECT * FROM authors WHERE id = $1",
        [id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Author not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

app.post(
  "/authors",
  validate(authorSchema, "body"),
  async (_req, res) => {
    const author = res.locals.validated as AuthorInput;

    try {
      const result = await pool.query<Author>(
        "INSERT INTO authors (name) VALUES ($1) RETURNING *",
        [author.name],
      );
      res.status(201).json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

app.put(
  "/authors/:id",
  validate(idParamSchema, "params"),
  validate(authorSchema, "body"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };
    const author = res.locals.validated as AuthorInput;

    try {
      const result = await pool.query<Author>(
        "UPDATE authors SET name = $1 WHERE id = $2 RETURNING *",
        [author.name, id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Author not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

app.delete(
  "/authors/:id",
  validate(idParamSchema, "params"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };

    try {
      const result = await pool.query<Author>(
        "DELETE FROM authors WHERE id = $1 RETURNING *",
        [id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Author not found" });
        return;
      }

      res.json({ message: "Author deleted" });
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

// -------------------- MEMBERS --------------------

app.get("/members", async (_req, res) => {
  try {
    const result = await pool.query<Member>(
      "SELECT * FROM members ORDER BY id",
    );
    res.json(result.rows);
  } catch (err: unknown) {
    handleDatabaseError(res, err);
  }
});

app.get(
  "/members/:id",
  validate(idParamSchema, "params"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };

    try {
      const result = await pool.query<Member>(
        "SELECT * FROM members WHERE id = $1",
        [id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Member not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

app.post(
  "/members",
  validate(memberSchema, "body"),
  async (_req, res) => {
    const member = res.locals.validated as MemberInput;

    try {
      const result = await pool.query<Member>(
        `INSERT INTO members (name, email)
         VALUES ($1, $2) RETURNING *`,
        [member.name, member.email],
      );

      res.status(201).json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

app.put(
  "/members/:id",
  validate(idParamSchema, "params"),
  validate(memberSchema, "body"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };
    const member = res.locals.validated as MemberInput;

    try {
      const result = await pool.query<Member>(
        `UPDATE members SET name = $1, email = $2
         WHERE id = $3 RETURNING *`,
        [member.name, member.email, id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Member not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

app.delete(
  "/members/:id",
  validate(idParamSchema, "params"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };

    try {
      const result = await pool.query<Member>(
        "DELETE FROM members WHERE id = $1 RETURNING *",
        [id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Member not found" });
        return;
      }

      res.json({ message: "Member deleted" });
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

// -------------------- LOANS --------------------

app.get("/loans", async (_req, res) => {
  try {
    const result = await pool.query<Loan>(
      "SELECT * FROM loans ORDER BY id",
    );
    res.json(result.rows);
  } catch (err: unknown) {
    handleDatabaseError(res, err);
  }
});

app.get(
  "/loans/:id",
  validate(idParamSchema, "params"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };

    try {
      const result = await pool.query<Loan>(
        "SELECT * FROM loans WHERE id = $1",
        [id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Loan not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

app.post(
  "/loans",
  validate(loanSchema, "body"),
  async (_req, res) => {
    const loan = res.locals.validated as LoanInput;

    try {
      const result = await pool.query<Loan>(
        `INSERT INTO loans (book_id, member_id)
         VALUES ($1, $2) RETURNING *`,
        [loan.book_id, loan.member_id],
      );

      res.status(201).json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

app.patch(
  "/loans/:id/return",
  validate(idParamSchema, "params"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };

    try {
      const result = await pool.query<Loan>(
        `UPDATE loans SET return_date = CURRENT_DATE
         WHERE id = $1 AND return_date IS NULL
         RETURNING *`,
        [id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: "Active loan not found",
        });
        return;
      }

      res.json(result.rows[0]);
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

app.delete(
  "/loans/:id",
  validate(idParamSchema, "params"),
  async (_req, res) => {
    const { id } = res.locals.validated as { id: number };

    try {
      const result = await pool.query<Loan>(
        "DELETE FROM loans WHERE id = $1 RETURNING *",
        [id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Loan not found" });
        return;
      }

      res.json({ message: "Loan deleted" });
    } catch (err: unknown) {
      handleDatabaseError(res, err);
    }
  },
);

// Malformed JSON sent by a client
app.use((
  err: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  if (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    err.type === "entity.parse.failed"
  ) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  console.error("Request error:", getErrorMessage(err));
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(env.PORT, () => {
  console.log(`Library API listening on port ${env.PORT}`);
});

function shutdown(): void {
  server.close(() => {
    void pool.end().catch((err: unknown) => {
      console.error("Error closing database pool:", getErrorMessage(err));
      process.exitCode = 1;
    });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);