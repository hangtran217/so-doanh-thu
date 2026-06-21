use chrono::Local;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const APP_STATE_KEY: &str = "main";

fn app_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Không lấy được thư mục dữ liệu ứng dụng: {err}"))?;
    fs::create_dir_all(&dir).map_err(|err| format!("Không tạo được thư mục dữ liệu: {err}"))?;
    Ok(dir)
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_dir(app)?.join("database");
    fs::create_dir_all(&dir).map_err(|err| format!("Không tạo được thư mục database: {err}"))?;
    Ok(dir.join("so_doanh_thu.sqlite"))
}

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let conn = Connection::open(path).map_err(|err| format!("Không mở được SQLite: {err}"))?;
    init_database(&conn)?;
    Ok(conn)
}

fn init_database(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
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
        "#,
    )
    .map_err(|err| format!("Không khởi tạo được schema SQLite: {err}"))?;
    Ok(())
}

fn v_string(v: &Value, key: &str) -> String {
    v.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn v_number(v: &Value, key: &str) -> f64 {
    match v.get(key) {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0),
        Some(Value::String(s)) => s.replace('.', "").replace(',', ".").parse::<f64>().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn sync_json_to_tables(conn: &mut Connection, payload: &str) -> Result<(), String> {
    let data: Value = serde_json::from_str(payload).map_err(|err| format!("JSON dữ liệu không hợp lệ: {err}"))?;
    let tx = conn.transaction().map_err(|err| format!("Không mở được transaction: {err}"))?;

    tx.execute("DELETE FROM settings", []).map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM order_items", []).map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM orders", []).map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM products", []).map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM customers", []).map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM suppliers", []).map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM expenses", []).map_err(|err| err.to_string())?;

    if let Some(settings) = data.get("settings").and_then(Value::as_object) {
        for (key, value) in settings {
            tx.execute(
                "INSERT INTO settings(key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
                params![key, value.as_str().map(str::to_string).unwrap_or_else(|| value.to_string())],
            )
            .map_err(|err| format!("Không lưu settings: {err}"))?;
        }
    }

    if let Some(products) = data.get("products").and_then(Value::as_array) {
        for p in products {
            let raw = serde_json::to_string(p).unwrap_or_default();
            tx.execute(
                r#"INSERT INTO products(id,name,category,product_type,supplier_id,public_price,default_cost,ctv_price,default_price,unit,note,created_at,updated_at,raw_json)
                   VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)"#,
                params![
                    v_string(p, "id"), v_string(p, "name"), v_string(p, "category"), v_string(p, "type"), v_string(p, "supplierId"),
                    v_number(p, "publicPrice"), v_number(p, "defaultCost"), v_number(p, "ctvPrice"), v_number(p, "defaultPrice"),
                    v_string(p, "unit"), v_string(p, "note"), v_string(p, "createdAt"), v_string(p, "updatedAt"), raw
                ],
            ).map_err(|err| format!("Không lưu products: {err}"))?;
        }
    }

    if let Some(customers) = data.get("customers").and_then(Value::as_array) {
        for c in customers {
            let raw = serde_json::to_string(c).unwrap_or_default();
            tx.execute(
                r#"INSERT INTO customers(id,name,phone,email,source,note,company_name,tax_code,invoice_email,invoice_address,buyer_name,raw_json)
                   VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)"#,
                params![
                    v_string(c, "id"), v_string(c, "name"), v_string(c, "phone"), v_string(c, "email"), v_string(c, "source"), v_string(c, "note"),
                    v_string(c, "companyName"), v_string(c, "taxCode"), v_string(c, "invoiceEmail"), v_string(c, "invoiceAddress"), v_string(c, "buyerName"), raw
                ],
            ).map_err(|err| format!("Không lưu customers: {err}"))?;
        }
    }

    if let Some(suppliers) = data.get("suppliers").and_then(Value::as_array) {
        for s in suppliers {
            let raw = serde_json::to_string(s).unwrap_or_default();
            tx.execute(
                r#"INSERT INTO suppliers(id,name,contact,phone,website,note,raw_json)
                   VALUES (?1,?2,?3,?4,?5,?6,?7)"#,
                params![v_string(s, "id"), v_string(s, "name"), v_string(s, "contact"), v_string(s, "phone"), v_string(s, "website"), v_string(s, "note"), raw],
            ).map_err(|err| format!("Không lưu suppliers: {err}"))?;
        }
    }

    if let Some(orders) = data.get("orders").and_then(Value::as_array) {
        for o in orders {
            let raw = serde_json::to_string(o).unwrap_or_default();
            let mut revenue = 0.0;
            let mut cost = 0.0;
            if let Some(items) = o.get("items").and_then(Value::as_array) {
                for item in items {
                    let q = v_number(item, "quantity");
                    let item_cost = q * v_number(item, "costPrice");
                    let item_revenue = q * v_number(item, "salePrice") - v_number(item, "discount");
                    cost += item_cost;
                    revenue += item_revenue;
                }
            }
            let profit = revenue - cost;
            tx.execute(
                r#"INSERT INTO orders(id,code,order_date,usage_date,customer_id,customer_name,status,paid,revenue,cost,profit,note,created_at,updated_at,raw_json)
                   VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)"#,
                params![
                    v_string(o, "id"), v_string(o, "code"), v_string(o, "orderDate"), v_string(o, "usageDate"), v_string(o, "customerId"),
                    v_string(o, "customerName"), v_string(o, "status"), v_number(o, "paid"), revenue, cost, profit,
                    v_string(o, "note"), v_string(o, "createdAt"), v_string(o, "updatedAt"), raw
                ],
            ).map_err(|err| format!("Không lưu orders: {err}"))?;

            if let Some(items) = o.get("items").and_then(Value::as_array) {
                for item in items {
                    let raw_item = serde_json::to_string(item).unwrap_or_default();
                    let item_id = if v_string(item, "id").is_empty() {
                        format!("{}-{}", v_string(o, "id"), v_string(item, "productId"))
                    } else {
                        v_string(item, "id")
                    };
                    tx.execute(
                        r#"INSERT INTO order_items(id,order_id,product_id,product_name,quantity,cost_price,sale_price,discount,note,raw_json)
                           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)"#,
                        params![item_id, v_string(o, "id"), v_string(item, "productId"), v_string(item, "productName"), v_number(item, "quantity"), v_number(item, "costPrice"), v_number(item, "salePrice"), v_number(item, "discount"), v_string(item, "note"), raw_item],
                    ).map_err(|err| format!("Không lưu order_items: {err}"))?;
                }
            }
        }
    }

    if let Some(expenses) = data.get("expenses").and_then(Value::as_array) {
        for e in expenses {
            let raw = serde_json::to_string(e).unwrap_or_default();
            tx.execute(
                r#"INSERT INTO expenses(id,expense_date,category,amount,description,raw_json)
                   VALUES (?1,?2,?3,?4,?5,?6)"#,
                params![v_string(e, "id"), v_string(e, "date"), v_string(e, "category"), v_number(e, "amount"), v_string(e, "description"), raw],
            ).map_err(|err| format!("Không lưu expenses: {err}"))?;
        }
    }

    tx.execute(
        "INSERT INTO app_state(key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP",
        params![APP_STATE_KEY, payload],
    )
    .map_err(|err| format!("Không lưu app_state: {err}"))?;

    tx.commit().map_err(|err| format!("Không commit được dữ liệu: {err}"))?;
    Ok(())
}

#[tauri::command]
fn get_app_data(app: AppHandle) -> Result<Option<String>, String> {
    let conn = open_connection(&app)?;
    conn.query_row(
        "SELECT value FROM app_state WHERE key = ?1",
        params![APP_STATE_KEY],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|err| format!("Không đọc được dữ liệu SQLite: {err}"))
}

#[tauri::command]
fn save_app_data(app: AppHandle, payload: String) -> Result<(), String> {
    let mut conn = open_connection(&app)?;
    sync_json_to_tables(&mut conn, &payload)
}

#[tauri::command]
fn get_database_path(app: AppHandle) -> Result<String, String> {
    Ok(database_path(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
fn backup_database(app: AppHandle) -> Result<String, String> {
    let source = database_path(&app)?;
    if !source.exists() {
        return Err("Chưa có file database để sao lưu.".to_string());
    }
    let backup_dir = app_dir(&app)?.join("backups");
    fs::create_dir_all(&backup_dir).map_err(|err| format!("Không tạo được thư mục backup: {err}"))?;
    let name = format!("so_doanh_thu_backup_{}.sqlite", Local::now().format("%Y-%m-%d_%H%M%S"));
    let target = backup_dir.join(name);
    fs::copy(&source, &target).map_err(|err| format!("Không copy được database: {err}"))?;
    Ok(target.to_string_lossy().to_string())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            if let Err(err) = open_connection(handle) {
                return Err(Box::<dyn std::error::Error>::from(std::io::Error::new(std::io::ErrorKind::Other, err)));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_data,
            save_app_data,
            get_database_path,
            backup_database
        ])
        .run(tauri::generate_context!())
        .expect("Lỗi khi chạy ứng dụng Sổ Doanh Thu HKD");
}
