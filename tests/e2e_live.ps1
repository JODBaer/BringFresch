# End-to-End-Test gegen Live-App, echten Server und echtes Bring! (fragt den WG-PIN verdeckt).
#   powershell -ExecutionPolicy Bypass -File tests\e2e_live.ps1 [-Cleanup] [-Out datei.txt]
param([switch]$Cleanup, [string]$Out = "")
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$p = Read-Host 'WG-PIN eingeben (wird nicht angezeigt)' -AsSecureString
$env:WG_PIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))
$a = @("$PSScriptRoot\e2e_live.mjs")
if ($Cleanup) { $a += '--cleanup' }
if ($Out) { $a += @('--out', $Out) }
Push-Location $PSScriptRoot
node @a
Pop-Location
Remove-Item Env:WG_PIN
