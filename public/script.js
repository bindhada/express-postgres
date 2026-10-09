const form = document.querySelector("#book-form");
const booksContainer = document.querySelector("#books");
const message = document.querySelector("#message");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? "error" : "success";
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `Request failed: ${response.status}`);
  }

  return result;
}

async function loadBooks() {
  booksContainer.replaceChildren();

  try {
    const books = await request("/books");

    if (books.length === 0) {
      booksContainer.textContent = "No books found.";
      return;
    }

    for (const book of books) {
      const card = document.createElement("article");
      card.className = "book";

      const title = document.createElement("h3");
      title.textContent = book.title;

      const details = document.createElement("p");
      details.textContent =
        `ID: ${book.id} | Genre: ${book.genre ?? "N/A"} | ` +
        `Year: ${book.published_year ?? "N/A"} | ` +
        `Author: ${book.author_name ?? "Unknown"}`;

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", async () => {
        const confirmed = window.confirm(
          `Delete "${book.title}"?`
        );

        if (!confirmed) return;

        try {
          await request(`/books/${book.id}`, {
            method: "DELETE",
          });

          showMessage("Book deleted successfully.");
          await loadBooks();
        } catch (err) {
          showMessage(err.message, true);
        }
      });

      card.append(title, details, deleteButton);
      booksContainer.append(card);
    }
  } catch (err) {
    showMessage(err.message, true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = document.querySelector("#title").value.trim();
  const genre = document.querySelector("#genre").value.trim();
  const yearText = document.querySelector("#published_year").value;
  const authorText = document.querySelector("#author_id").value;

  const body = {
    title,
    genre: genre || null,
    published_year: yearText === "" ? null : Number(yearText),
    author_id: authorText === "" ? null : Number(authorText),
  };

  try {
    await request("/books", {
      method: "POST",
      body: JSON.stringify(body),
    });

    form.reset();
    showMessage("Book created successfully.");
    await loadBooks();
  } catch (err) {
    showMessage(err.message, true);
  }
});

document.querySelector("#refresh").addEventListener("click", loadBooks);

loadBooks();