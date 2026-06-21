$ErrorActionPreference = "Stop"

Write-Host "== Sổ Doanh Thu HKD - Build Windows ==" -ForegroundColor Cyan

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Chưa cài Node.js."
}
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Chưa cài npm."
}
if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
  throw "Chưa cài Rust/Cargo."
}

npm install
npm run tauri:build

Write-Host "Build xong. Kiểm tra thư mục: src-tauri/target/release/bundle/nsis" -ForegroundColor Green
