# Кладёт токен бота в секреты: релей Cloudflare (stevent-relay) и функцию Яндекс.Облака (stevent-leads).
# Ключ релея (общий пароль функции и релея) генерируется заново и нигде не показывается.
# Токен не сохраняется в файлах и не попадает в git.
# Запуск: powershell -ExecutionPolicy Bypass -File .\setup-secrets.ps1

function Check($step) {
  if ($LASTEXITCODE -ne 0) { Write-Host "Ошибка на шаге: $step. Пришлите Claude скриншот этого окна." -ForegroundColor Red; exit 1 }
}
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$yc = Join-Path $env:USERPROFILE 'yandex-cloud\bin\yc.exe'

Write-Host ''
Write-Host 'Вставьте токен бота (правая кнопка мыши) и нажмите Enter.' -ForegroundColor Yellow
Write-Host 'Символы не будут видны - так и задумано.' -ForegroundColor Yellow
$secure = Read-Host 'Токен' -AsSecureString
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if ($token -notmatch '^\d+:[A-Za-z0-9_-]{30,}$') {
  Write-Host 'Это не похоже на токен бота (должно быть вида 1234567890:AAH...). Запустите скрипт ещё раз.' -ForegroundColor Red
  exit 1
}

# Случайный ключ релея: 48 символов
$bytes = New-Object byte[] 36
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$relayKey = [Convert]::ToBase64String($bytes).Replace('+', 'A').Replace('/', 'B').Replace('=', '')

Write-Host ''
Write-Host '1/3 Токен -> Cloudflare...' -ForegroundColor Cyan
Push-Location (Join-Path $here 'stevent-relay')
$token | npx --yes wrangler@3 secret put TELEGRAM_BOT_TOKEN 2>$null | Out-Null
Check 'токен в Cloudflare'
Write-Host '2/3 Ключ релея -> Cloudflare...' -ForegroundColor Cyan
$relayKey | npx --yes wrangler@3 secret put RELAY_KEY 2>$null | Out-Null
Check 'ключ в Cloudflare'
Pop-Location

Write-Host '3/3 Токен и ключ -> Яндекс.Облако (новая версия функции)...' -ForegroundColor Cyan
$envs = "TELEGRAM_CHAT_ID=@helpppevent,TELEGRAM_API_BASE=https://stevent-relay.ngperm.workers.dev,TELEGRAM_BOT_TOKEN=$token,TELEGRAM_RELAY_KEY=$relayKey"
& $yc serverless function version create --function-name stevent-leads --runtime nodejs22 --entrypoint index.handler --memory 128m --execution-timeout 20s --source-path (Join-Path $here 'leads') --environment $envs 2>$null | Out-Null
Check 'Яндекс.Облако'

$token = $null; $relayKey = $null; $envs = $null
Write-Host ''
Write-Host 'Готово! Напишите Claude: «секреты вставлены».' -ForegroundColor Green
