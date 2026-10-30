# Starts the native (non-Docker) local stack on Windows in separate windows:
#   WSL Postgres + Redis, Mailpit, API (:4000) and web (:3000).
# Prerequisites: scripts/wsl-infra.sh setup done once, apps/api/.env configured,
# `pnpm install`, `pnpm build`, and Mailpit installed (winget install axllent.mailpit).
$root = Split-Path -Parent $PSScriptRoot
$wslScript = (wsl -d Ubuntu-24.04 -- wslpath -a ($root + '\scripts\wsl-infra.sh')).Trim()

Start-Process powershell -ArgumentList '-NoExit', '-Command', "wsl -d Ubuntu-24.04 -- bash '$wslScript' start"
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'mailpit --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025'
Start-Sleep -Seconds 5
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\apps\api'; node dist/main.js"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\apps\web'; npx next start --port 3000"
Write-Host 'Starting... open http://localhost:3000 (Mailpit: http://localhost:8025, API docs: http://localhost:4000/api/docs)'
