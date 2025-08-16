-- Initial database schema
-- This migration creates the basic POS system tables

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Products table with enhanced fields
ALTER TABLE products ADD COLUMN tax_rate REAL DEFAULT 0.18;
ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN supplier TEXT;
ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1;

-- Sales table enhancements
ALTER TABLE sales ADD COLUMN tax_amount REAL DEFAULT 0;
ALTER TABLE sales ADD COLUMN notes TEXT;

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories (id)
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create payment_transactions table for detailed payment tracking
CREATE TABLE IF NOT EXISTS payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  amount REAL NOT NULL,
  transaction_id TEXT,
  pos_response TEXT,
  status TEXT DEFAULT 'completed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products (supplier);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales (status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_sale_id ON payment_transactions (sale_id);

-- Insert default categories
INSERT OR IGNORE INTO categories (name, description) VALUES 
('İçecek', 'Soğuk ve sıcak içecekler'),
('Fırın', 'Ekmek ve fırın ürünleri'),
('Süt Ürünleri', 'Süt, peynir, yoğurt'),
('Temizlik', 'Temizlik malzemeleri'),
('Kişisel Bakım', 'Kişisel bakım ürünleri'),
('Gıda', 'Genel gıda ürünleri');
