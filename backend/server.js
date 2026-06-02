require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const JWT_EXPIRES = "7d";

function sqlConfig() {
  return {
    server: process.env.SQLSERVER_SERVER || "localhost",
    port: Number(process.env.SQLSERVER_PORT) || 1433,
    user: process.env.SQLSERVER_USER || "sa",
    password: process.env.SQLSERVER_PASSWORD ?? "",
    database: process.env.SQLSERVER_DATABASE || "inventory_db",
    options: {
      encrypt: process.env.SQLSERVER_ENCRYPT !== "false",
      trustServerCertificate: process.env.SQLSERVER_TRUST_CERT !== "false",
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

let poolPromise;
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(sqlConfig()).connect();
  }
  return poolPromise;
}

function isUniqueViolation(err) {
  return err && (err.number === 2627 || err.number === 2601);
}

const app = express();
app.use(cors());
app.use(express.json());

const frontendDir = path.join(__dirname, "..", "frontend");

function signToken(userRow) {
  return jwt.sign({ sub: userRow.id, email: userRow.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
}

async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, payload.sub)
      .query(
        "SELECT TOP 1 id, email, full_name FROM users WHERE id = @id"
      );
    const rows = result.recordset;
    if (!rows.length) return res.status(401).json({ error: "Unauthorized" });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const full_name = String(req.body.full_name || "").trim() || null;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const hash = await bcrypt.hash(password, 10);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("email", sql.NVarChar(255), email)
      .input("password_hash", sql.NVarChar(255), hash)
      .input("full_name", sql.NVarChar(255), full_name)
      .query(
        `INSERT INTO users (email, password_hash, full_name)
         OUTPUT INSERTED.id AS id
         VALUES (@email, @password_hash, @full_name)`
      );
    const id = result.recordset[0].id;
    res.status(201).json({
      message: "Registered successfully.",
      user: { id, email, full_name },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }
    console.error(e);
    res.status(500).json({ error: "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const pool = await getPool();
    const result = await pool
      .request()
      .input("email", sql.NVarChar(255), email)
      .query(
        "SELECT TOP 1 id, email, password_hash, full_name FROM users WHERE email = @email"
      );
    const rows = result.recordset;
    if (!rows.length) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const row = rows[0];
    const stored = String(row.password_hash || "");
    let ok = false;

    // Backward compatibility: some old/manual rows might store plain text.
    // Accept once, then immediately upgrade to bcrypt hash.
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
      ok = await bcrypt.compare(password, stored);
    } else {
      ok = password === stored;
      if (ok) {
        const newHash = await bcrypt.hash(password, 10);
        await pool
          .request()
          .input("id", sql.Int, row.id)
          .input("password_hash", sql.NVarChar(255), newHash)
          .query("UPDATE users SET password_hash = @password_hash WHERE id = @id");
      }
    }

    if (!ok) return res.status(401).json({ error: "Invalid email or password." });
    const user = { id: row.id, email: row.email, full_name: row.full_name };
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed." });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      full_name: req.user.full_name,
    },
  });
});

app.get("/api/categories", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      "SELECT id, name, description, created_at FROM categories ORDER BY name ASC"
    );
    res.json(result.recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load categories." });
  }
});

app.post("/api/categories", authMiddleware, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = req.body.description ? String(req.body.description).trim() : null;
    if (!name) return res.status(400).json({ error: "Name is required." });
    const pool = await getPool();
    const result = await pool
      .request()
      .input("name", sql.NVarChar(255), name)
      .input("description", sql.NVarChar(sql.MAX), description)
      .query(
        `INSERT INTO categories (name, description)
         OUTPUT INSERTED.*
         VALUES (@name, @description)`
      );
    res.status(201).json(result.recordset[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create category." });
  }
});

app.patch("/api/categories/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name || "").trim();
    const description = req.body.description ? String(req.body.description).trim() : null;
    if (!id || !name) return res.status(400).json({ error: "Invalid category." });
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("name", sql.NVarChar(255), name)
      .input("description", sql.NVarChar(sql.MAX), description)
      .query(
        "UPDATE categories SET name = @name, description = @description WHERE id = @id"
      );
    const sel = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM categories WHERE id = @id");
    if (!sel.recordset.length) return res.status(404).json({ error: "Not found." });
    res.json(sel.recordset[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update category." });
  }
});

app.delete("/api/categories/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const cntResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT COUNT(*) AS cnt FROM products WHERE category_id = @id");
    const cnt = cntResult.recordset[0].cnt;
    if (cnt > 0) {
      return res.status(400).json({
        error: "Cannot delete category that still has products.",
      });
    }
    const del = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM categories WHERE id = @id");
    if (!del.rowsAffected[0]) return res.status(404).json({ error: "Not found." });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete category." });
  }
});

app.get("/api/suppliers", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      "SELECT id, name FROM suppliers ORDER BY name ASC"
    );
    res.json(result.recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load suppliers." });
  }
});

app.get("/api/products", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT id, name, price, quantity, min_stock_level, category_id, supplier_id
       FROM products ORDER BY name ASC`
    );
    res.json(result.recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load products." });
  }
});

app.post("/api/products", authMiddleware, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Product name is required." });
    const category_id = req.body.category_id ? Number(req.body.category_id) : null;
    const supplier_id = req.body.supplier_id ? Number(req.body.supplier_id) : null;
    const price = Number(req.body.price ?? 0);
    const quantity = Number(req.body.quantity ?? 0);
    const min_stock_level = Number(req.body.min_stock_level ?? 0);
    if (price < 0 || quantity < 0 || min_stock_level < 0) {
      return res.status(400).json({ error: "Invalid numeric fields." });
    }
    const pool = await getPool();
    const result = await pool
      .request()
      .input("name", sql.NVarChar(255), name)
      .input("category_id", sql.Int, category_id)
      .input("supplier_id", sql.Int, supplier_id)
      .input("price", sql.Decimal(12, 2), price)
      .input("quantity", sql.Int, quantity)
      .input("min_stock_level", sql.Int, min_stock_level)
      .query(
        `INSERT INTO products (name, category_id, supplier_id, price, quantity, min_stock_level)
         OUTPUT INSERTED.id, INSERTED.name, INSERTED.price, INSERTED.quantity,
                INSERTED.min_stock_level, INSERTED.category_id, INSERTED.supplier_id
         VALUES (@name, @category_id, @supplier_id, @price, @quantity, @min_stock_level)`
      );
    res.status(201).json(result.recordset[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create product." });
  }
});

app.get("/api/stock-transactions", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT st.id, st.product_id, st.movement_type, st.quantity, st.reason, st.occurred_at,
              p.name AS product_name
       FROM stock_transactions st
       INNER JOIN products p ON p.id = st.product_id
       ORDER BY st.occurred_at DESC`
    );
    const mapped = result.recordset.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      movement_type: r.movement_type,
      quantity: r.quantity,
      reason: r.reason,
      occurred_at: r.occurred_at,
      products: { name: r.product_name },
    }));
    res.json(mapped);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load stock transactions." });
  }
});

app.post("/api/stock-transactions", authMiddleware, async (req, res) => {
  const product_id = Number(req.body.product_id);
  const movement_type = req.body.movement_type;
  const quantity = parseInt(req.body.quantity, 10);
  const reason = req.body.reason ? String(req.body.reason).trim() : null;
  const occurred_at = req.body.occurred_at
    ? new Date(req.body.occurred_at)
    : new Date();

  if (!product_id || !["IN", "OUT"].includes(movement_type)) {
    return res.status(400).json({ error: "Invalid movement." });
  }
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: "Quantity must be greater than 0." });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const selReq = new sql.Request(transaction);
    const prodResult = await selReq
      .input("pid", sql.Int, product_id)
      .query(
        "SELECT quantity FROM products WITH (UPDLOCK, ROWLOCK) WHERE id = @pid"
      );
    const prodRows = prodResult.recordset;
    if (!prodRows.length) {
      await transaction.rollback();
      return res.status(404).json({ error: "Product not found." });
    }
    const current = Number(prodRows[0].quantity);
    const delta = movement_type === "IN" ? quantity : -quantity;
    const next = current + delta;
    if (movement_type === "OUT" && next < 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Not enough stock." });
    }
    const insReq = new sql.Request(transaction);
    await insReq
      .input("product_id", sql.Int, product_id)
      .input("movement_type", sql.VarChar(10), movement_type)
      .input("quantity", sql.Int, quantity)
      .input("reason", sql.NVarChar(500), reason)
      .input("occurred_at", sql.DateTime2, occurred_at)
      .query(
        `INSERT INTO stock_transactions (product_id, movement_type, quantity, reason, occurred_at)
         VALUES (@product_id, @movement_type, @quantity, @reason, @occurred_at)`
      );
    const updReq = new sql.Request(transaction);
    await updReq
      .input("next", sql.Int, next)
      .input("pid", sql.Int, product_id)
      .query("UPDATE products SET quantity = @next WHERE id = @pid");
    await transaction.commit();
    res.status(201).json({ ok: true });
  } catch (e) {
    await transaction.rollback();
    console.error(e);
    res.status(500).json({ error: "Failed to record stock movement." });
  }
});

app.get("/api/sales", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT s.id, s.product_id, s.quantity, s.unit_price, s.total_price, s.sale_date,
              p.name AS product_name
       FROM sales s
       INNER JOIN products p ON p.id = s.product_id
       ORDER BY s.sale_date DESC`
    );
    const mapped = result.recordset.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      quantity: r.quantity,
      unit_price: Number(r.unit_price),
      total_price: Number(r.total_price),
      sale_date: r.sale_date,
      products: { name: r.product_name },
    }));
    res.json(mapped);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load sales." });
  }
});

app.post("/api/sales", authMiddleware, async (req, res) => {
  const product_id = Number(req.body.product_id);
  const quantity = parseInt(req.body.quantity, 10);
  const unit_price = Number(req.body.unit_price);
  const sale_date = req.body.sale_date ? new Date(req.body.sale_date) : new Date();

  if (!product_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "Invalid sale." });
  }
  if (!unit_price || unit_price <= 0) {
    return res.status(400).json({ error: "Invalid unit price." });
  }
  const total_price = Math.round(quantity * unit_price * 100) / 100;

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const selReq = new sql.Request(transaction);
    const prodResult = await selReq
      .input("pid", sql.Int, product_id)
      .query(
        "SELECT quantity FROM products WITH (UPDLOCK, ROWLOCK) WHERE id = @pid"
      );
    const prodRows = prodResult.recordset;
    if (!prodRows.length) {
      await transaction.rollback();
      return res.status(404).json({ error: "Product not found." });
    }
    const current = Number(prodRows[0].quantity);
    if (quantity > current) {
      await transaction.rollback();
      return res.status(400).json({ error: "Not enough stock." });
    }
    const insReq = new sql.Request(transaction);
    await insReq
      .input("product_id", sql.Int, product_id)
      .input("quantity", sql.Int, quantity)
      .input("unit_price", sql.Decimal(12, 2), unit_price)
      .input("total_price", sql.Decimal(12, 2), total_price)
      .input("sale_date", sql.DateTime2, sale_date)
      .query(
        `INSERT INTO sales (product_id, quantity, unit_price, total_price, sale_date)
         VALUES (@product_id, @quantity, @unit_price, @total_price, @sale_date)`
      );
    const updReq = new sql.Request(transaction);
    await updReq
      .input("next", sql.Int, current - quantity)
      .input("pid", sql.Int, product_id)
      .query("UPDATE products SET quantity = @next WHERE id = @pid");
    await transaction.commit();
    res.status(201).json({ ok: true });
  } catch (e) {
    await transaction.rollback();
    console.error(e);
    res.status(500).json({ error: "Failed to record sale." });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.use(express.static(frontendDir));

async function start() {
  try {
    await getPool();
    console.log("Connected to SQL Server:", sqlConfig().database);
    app.listen(PORT, () => {
      console.log(`Inventory API listening on http://localhost:${PORT}`);
      console.log(`Serving frontend from ${frontendDir}`);
    });
  } catch (err) {
    console.error("Could not connect to SQL Server. Check .env and that the database exists.", err);
    process.exit(1);
  }
}

start();
