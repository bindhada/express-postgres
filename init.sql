-- Authors: one author can write many books.
CREATE TABLE authors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Books: each book can optionally have one author.
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    genre VARCHAR(50),
    published_year INT,
    author_id INT REFERENCES authors(id)
);

-- Members: email addresses must be unique.
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE
);

-- Loans: connects members to books.
CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    book_id INT NOT NULL REFERENCES books(id),
    member_id INT NOT NULL REFERENCES members(id),
    borrowed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMP
);

-- Sample authors.
INSERT INTO authors (name)
VALUES
    ('J.R.R. Tolkien'),
    ('George Orwell'),
    ('Astrid Lindgren'),
    ('Suzanne Collins');

-- Sample books.
INSERT INTO books (title, genre, published_year, author_id)
VALUES
    ('The Hobbit', 'fantasy', 1937, 1),
    ('1984', 'dystopian', 1949, 2),
    ('Pippi Longstocking', 'children', 1945, 3),
    ('The Hunger Games', 'dystopian', 2008, 4);

-- Sample members.
INSERT INTO members (name, email)
VALUES
    ('Alice Nguyen', 'alice@example.com'),
    ('Bob Tran', 'bob@example.com');