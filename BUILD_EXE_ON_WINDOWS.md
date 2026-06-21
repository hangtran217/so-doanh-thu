# Cách build ra file .exe trên Windows

Máy build cần có:
- Windows 11
- Node.js 22 LTS
- Rust stable
- Microsoft Edge WebView2 Runtime

Chạy trong thư mục project:

```powershell
npm install
npm run tauri:build
```

File .exe sau khi build nằm tại:

```txt
src-tauri/target/release/bundle/nsis/
```

Nếu dùng GitHub Actions, upload toàn bộ project lên GitHub, vào tab Actions → Build Windows EXE → Run workflow. Sau khi chạy xong, tải artifact tên `So-Doanh-Thu-Windows-Installer`.
