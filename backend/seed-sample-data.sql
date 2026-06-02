/*
  Sample categories + products (linked by category)
  Run in SSMS after schema-sqlserver.sql — safe to run multiple times (skips duplicates by name).
*/

USE inventory_db;
GO

SET NOCOUNT ON;

/* --- Categories --- */
IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE name = N'Electronics')
  INSERT INTO dbo.categories (name, description)
  VALUES (N'Electronics', N'Gadgets, cables, chargers, and accessories');

IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE name = N'Office Supplies')
  INSERT INTO dbo.categories (name, description)
  VALUES (N'Office Supplies', N'Paper, pens, organizers, and everyday desk items');

IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE name = N'Furniture')
  INSERT INTO dbo.categories (name, description)
  VALUES (N'Furniture', N'Chairs, desks, and workspace furniture');

IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE name = N'Food & Beverage')
  INSERT INTO dbo.categories (name, description)
  VALUES (N'Food & Beverage', N'Break-room snacks and drinks');

GO

DECLARE @supplier INT = (SELECT TOP (1) id FROM dbo.suppliers ORDER BY id);

DECLARE @catElectronics INT = (SELECT id FROM dbo.categories WHERE name = N'Electronics');
DECLARE @catOffice INT      = (SELECT id FROM dbo.categories WHERE name = N'Office Supplies');
DECLARE @catFurniture INT = (SELECT id FROM dbo.categories WHERE name = N'Furniture');
DECLARE @catFood INT       = (SELECT id FROM dbo.categories WHERE name = N'Food & Beverage');

/* --- Electronics --- */
IF @catElectronics IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'Wireless Mouse')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'Wireless Mouse', @catElectronics, @supplier, 29.99, 45, 12);

IF @catElectronics IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'USB-C Cable 2m')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'USB-C Cable 2m', @catElectronics, @supplier, 12.50, 120, 30);

IF @catElectronics IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'LED Desk Lamp')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'LED Desk Lamp', @catElectronics, @supplier, 39.00, 18, 5);

IF @catElectronics IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'Bluetooth Speaker')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'Bluetooth Speaker', @catElectronics, @supplier, 54.99, 22, 8);

/* --- Office Supplies --- */
IF @catOffice IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'A4 Paper Ream (500)')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'A4 Paper Ream (500)', @catOffice, @supplier, 8.99, 80, 20);

IF @catOffice IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'Ballpoint Pens (box of 50)')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'Ballpoint Pens (box of 50)', @catOffice, @supplier, 14.25, 35, 10);

IF @catOffice IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'Sticky Notes (12 pads)')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'Sticky Notes (12 pads)', @catOffice, @supplier, 11.00, 50, 15);

/* --- Furniture --- */
IF @catFurniture IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'Ergonomic Office Chair')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'Ergonomic Office Chair', @catFurniture, @supplier, 249.00, 6, 2);

IF @catFurniture IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'Standing Desk 120cm')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'Standing Desk 120cm', @catFurniture, @supplier, 419.99, 4, 1);

/* --- Food & Beverage --- */
IF @catFood IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'Coffee Beans 1kg')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'Coffee Beans 1kg', @catFood, @supplier, 24.50, 28, 8);

IF @catFood IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'Mixed Snack Box')
  INSERT INTO dbo.products (name, category_id, supplier_id, price, quantity, min_stock_level)
  VALUES (N'Mixed Snack Box', @catFood, @supplier, 18.75, 40, 12);

PRINT N'Sample categories/products seeded (skipped rows that already exist).';
GO
