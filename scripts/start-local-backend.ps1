# Запуск API + статики ИНК на ноутбуке (Windows).
# Требования: PostgreSQL запущен, БД inkauth восстановлена (см. backups/ или schema.sql).

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql://inkauth:inkauth@127.0.0.1:5432/inkauth"
}
if (-not $env:PORT) {
  $env:PORT = "3000"
}

Set-Location (Join-Path $repoRoot "backend")
Write-Host "ИНК: http://127.0.0.1:$($env:PORT)/  (остановить: Ctrl+C)"
node src/server.js
