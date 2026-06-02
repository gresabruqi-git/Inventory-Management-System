-- Inventory Management schema for MySQL 8+ (optional — SSMS users: use schema-sqlserver.sql instead)
-- Run: mysql -u root -p < schema.sql
-- Or paste into MySQL Workbench after creating database.

CREATE DATABASE IF NOT EXISTS inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventory_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id INT NULL,
  supplier_id INT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  min_stock_level INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  movement_type ENUM ('IN', 'OUT') NOT NULL,
  quantity INT NOT NULL,
  reason VARCHAR(500) NULL,
  occurred_at DATETIME NOT NULL,
  CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  sale_date DATETIME NOT NULL,
  CONSTRAINT fk_sales_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- Optional sample supplier for product forms (add more as needed)
INSERT INTO suppliers (name) SELECT 'Default supplier' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM suppliers LIMIT 1);
