PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  product_type TEXT,
  supplier_id TEXT,
  public_price REAL DEFAULT 0,
  default_cost REAL DEFAULT 0,
  ctv_price REAL DEFAULT 0,
  default_price REAL DEFAULT 0,
  unit TEXT,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  note TEXT,
  company_name TEXT,
  tax_code TEXT,
  invoice_email TEXT,
  invoice_address TEXT,
  buyer_name TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  website TEXT,
  note TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  code TEXT,
  order_date TEXT,
  usage_date TEXT,
  customer_id TEXT,
  customer_name TEXT,
  status TEXT,
  paid REAL DEFAULT 0,
  revenue REAL DEFAULT 0,
  cost REAL DEFAULT 0,
  profit REAL DEFAULT 0,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  quantity REAL DEFAULT 0,
  cost_price REAL DEFAULT 0,
  sale_price REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  note TEXT,
  raw_json TEXT NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  expense_date TEXT,
  category TEXT,
  amount REAL DEFAULT 0,
  description TEXT,
  raw_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
