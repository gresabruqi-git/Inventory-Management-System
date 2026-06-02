/*
  Inventory Management — Microsoft SQL Server (SSMS)
  Copy this entire file into a new query window and click Execute.

  Creates database inventory_db (if missing) and all tables.
*/

SET NOCOUNT ON;
GO

IF DB_ID(N'inventory_db') IS NULL
BEGIN
  CREATE DATABASE inventory_db;
END
GO

USE inventory_db;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* --- users --- */
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id INT IDENTITY(1,1) NOT NULL,
    email NVARCHAR(255) NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    full_name NVARCHAR(255) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_users PRIMARY KEY CLUSTERED (id),
    CONSTRAINT UQ_users_email UNIQUE (email)
  );
END
GO

/* --- categories --- */
IF OBJECT_ID(N'dbo.categories', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.categories (
    id INT IDENTITY(1,1) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_categories_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_categories PRIMARY KEY CLUSTERED (id)
  );
END
GO

/* --- suppliers --- */
IF OBJECT_ID(N'dbo.suppliers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.suppliers (
    id INT IDENTITY(1,1) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_suppliers_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_suppliers PRIMARY KEY CLUSTERED (id)
  );
END
GO

/* --- products --- */
IF OBJECT_ID(N'dbo.products', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.products (
    id INT IDENTITY(1,1) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    category_id INT NULL,
    supplier_id INT NULL,
    price DECIMAL(12, 2) NOT NULL CONSTRAINT DF_products_price DEFAULT (0),
    quantity INT NOT NULL CONSTRAINT DF_products_quantity DEFAULT (0),
    min_stock_level INT NOT NULL CONSTRAINT DF_products_min_stock DEFAULT (0),
    CONSTRAINT PK_products PRIMARY KEY CLUSTERED (id),
    CONSTRAINT FK_products_category FOREIGN KEY (category_id) REFERENCES dbo.categories (id) ON DELETE SET NULL,
    CONSTRAINT FK_products_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers (id) ON DELETE SET NULL
  );
END
GO

/* --- stock_transactions --- */
IF OBJECT_ID(N'dbo.stock_transactions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.stock_transactions (
    id INT IDENTITY(1,1) NOT NULL,
    product_id INT NOT NULL,
    movement_type VARCHAR(10) NOT NULL,
    quantity INT NOT NULL,
    reason NVARCHAR(500) NULL,
    occurred_at DATETIME2(0) NOT NULL,
    CONSTRAINT PK_stock_transactions PRIMARY KEY CLUSTERED (id),
    CONSTRAINT CK_stock_transactions_movement CHECK (movement_type IN (N'IN', N'OUT')),
    CONSTRAINT FK_stock_transactions_product FOREIGN KEY (product_id) REFERENCES dbo.products (id) ON DELETE CASCADE
  );
END
GO

/* --- sales --- */
IF OBJECT_ID(N'dbo.sales', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sales (
    id INT IDENTITY(1,1) NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    sale_date DATETIME2(0) NOT NULL,
    CONSTRAINT PK_sales PRIMARY KEY CLUSTERED (id),
    CONSTRAINT FK_sales_product FOREIGN KEY (product_id) REFERENCES dbo.products (id) ON DELETE CASCADE
  );
END
GO

/* Optional default supplier for dropdowns */
IF NOT EXISTS (SELECT 1 FROM dbo.suppliers)
BEGIN
  INSERT INTO dbo.suppliers (name) VALUES (N'Default supplier');
END
GO

PRINT N'Done: inventory_db is ready.';
PRINT N'Optional: run seed-sample-data.sql for demo categories and products.';
GO
