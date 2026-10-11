CREATE TABLE IF NOT EXISTS authors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL
    CHECK (char_length(name) BETWEEN 2 AND 50)
);

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  genre VARCHAR(50),
  published_year INTEGER NOT NULL
    CHECK (published_year BETWEEN 1000 AND 2100),
  author_id INTEGER REFERENCES authors(id)
);

CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  member_id INTEGER NOT NULL REFERENCES members(id),
  loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  return_date DATE
);

INSERT INTO authors (name)
VALUES ('Jane Austen'), ('George Orwell')
ON CONFLICT DO NOTHING;

INSERT INTO books (title, genre, published_year, author_id)
SELECT 'Pride and Prejudice', 'Classic', 1813, id
FROM authors
WHERE name = 'Jane Austen'
AND NOT EXISTS (
  SELECT 1 FROM books WHERE title = 'Pride and Prejudice'
);

INSERT INTO members (name, email)
VALUES ('Anna Example', 'anna@example.com')
ON CONFLICT (email) DO NOTHING;