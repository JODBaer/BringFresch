# Live-Test gegen den Test-Server und die Bring!-Liste «Home-test» des Bots (fragt den Test-PIN verdeckt).
#   powershell -ExecutionPolicy Bypass -File tests\stage_live.ps1
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$p = Read-Host 'Test-PIN eingeben (wird nicht angezeigt)' -AsSecureString
$env:STAGE_PIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))
Push-Location $PSScriptRoot
node stage_live.mjs
Pop-Location
Remove-Item Env:STAGE_PIN
