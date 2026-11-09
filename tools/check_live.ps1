# Live-Check starten (Windows): fragt den WG-PIN verdeckt ab und ruft check_live.mjs auf.
#   powershell -ExecutionPolicy Bypass -File tools\check_live.ps1 [-Out datei.txt]
param([string]$Out = "")
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$p = Read-Host 'WG-PIN eingeben (wird nicht angezeigt)' -AsSecureString
$env:WG_PIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))
$args2 = @("$PSScriptRoot\check_live.mjs")
if ($Out) { $args2 += @('--out', $Out) }
node @args2
Remove-Item Env:WG_PIN
