# Sổ Doanh Thu HKD - Tauri + SQLite

Bản này giữ nguyên giao diện/chức năng của V16 và nâng cấp tầng lưu dữ liệu sang SQLite thật.

## Điểm thay đổi chính

- Dữ liệu không còn chỉ lưu trong `localStorage` của trình duyệt.
- Khi chạy bằng Tauri, dữ liệu được lưu vào file SQLite:
  - Windows: `%APPDATA%/com.sodoanhthu.hkd/database/so_doanh_thu.sqlite`
- Khi mở lần đầu, nếu người dùng có dữ liệu cũ trong `localStorage`, phần mềm tự import sang SQLite.
- Vẫn giữ nút sao lưu JSON để dự phòng.
- Thêm nút:
  - `Xem vị trí file SQLite`
  - `Sao lưu SQLite`

## Cách chạy cho lập trình viên

Cài Node.js, Rust, Tauri prerequisite cho Windows, sau đó chạy:

```powershell
npm install
npm run tauri:dev
```

## Cách build file cài đặt Windows

```powershell
npm install
npm run tauri:build
```

File cài đặt nằm tại:

```txt
src-tauri/target/release/bundle/nsis/
```

## Cấu trúc dữ liệu

SQLite có 2 lớp lưu:

1. `app_state`: lưu toàn bộ dữ liệu dạng JSON để giữ tương thích 100% với code V16.
2. Các bảng chuẩn hóa như `products`, `customers`, `suppliers`, `orders`, `order_items`, `expenses` để sau này dễ nâng cấp báo cáo/database.

Xem schema tại:

```txt
docs/DATABASE_SCHEMA.sql
```

Xem ERD tại:

```txt
docs/ERD.md
```
