# Выкладывает новый код функции stevent-leads (папка leads/), сохраняя её переменные
# (токен бота, ключ релея и т. д.) — значения берутся из текущей версии и нигде не показываются.
# Запуск: powershell -ExecutionPolicy Bypass -File .\deploy-leads.ps1

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$yc = Join-Path $env:USERPROFILE 'yandex-cloud\bin\yc.exe'

Write-Host '1/2 Беру переменные текущей версии stevent-leads...' -ForegroundColor Cyan
$json = & $yc serverless function version get-by-tag --function-name stevent-leads --tag '$latest' --format json 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host 'Не получилось прочитать stevent-leads.' -ForegroundColor Red; exit 1 }
$e = ($json | Out-String | ConvertFrom-Json).environment
if (-not $e.TELEGRAM_BOT_TOKEN) { Write-Host 'В stevent-leads нет токена — сначала setup-secrets.ps1.' -ForegroundColor Red; exit 1 }
$envs = ($e.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ','

Write-Host '2/2 Выкладываю новый код...' -ForegroundColor Cyan
& $yc serverless function version create --function-name stevent-leads --runtime nodejs22 --entrypoint index.handler --memory 128m --execution-timeout 20s --source-path (Join-Path $here 'leads') --environment $envs 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'Не получилось выложить код.' -ForegroundColor Red; exit 1 }

$e = $null; $json = $null; $envs = $null
Write-Host 'Готово!' -ForegroundColor Green
