# Einmalig: Zugangsdaten für den TEST-Server (Worker bringfrisch-test: Test-Seite + Test-Server) setzen.
#   powershell -ExecutionPolicy Bypass -File worker\setup-stage.ps1
# Fragt E-Mail und Passwort des Bring!-Bots (allmenbot) und einen Test-PIN verdeckt ab.
# Der Test-PIN ist NICHT der WG-PIN: eigener PIN nur für die Test-Seite und den Live-Test (GitHub-Secret STAGE_PIN).
# Der Kalender-Token wird zufällig erzeugt. Nichts davon wird angezeigt oder gespeichert.
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
Push-Location $PSScriptRoot
function Plain($s) { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
function Put($name, $value) {
  $value | npx wrangler secret put $name --env stage | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host "  $name gesetzt" } else { Write-Host "  $name FEHLER" -ForegroundColor Red }
}
$mail = Read-Host 'Bring!-Bot E-Mail (allmenbot@gmail.com)'
if (-not $mail) { $mail = 'allmenbot@gmail.com' }
$pw = Plain (Read-Host 'Bring!-Bot Passwort (wird nicht angezeigt)' -AsSecureString)
$pin = Plain (Read-Host 'Neuer Test-PIN (wird nicht angezeigt)' -AsSecureString)
$cal = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
Put 'BRING_EMAIL' $mail
Put 'BRING_PASSWORD' $pw
Put 'WG_PIN' $pin
Put 'CAL_TOKEN' $cal
Remove-Variable pw, pin, cal
Pop-Location
Write-Host "`nFertig. Test-Seite: https://bringfrisch-test.bringfrisch-worker.workers.dev (dort unter Einstellungen > Mehr den Test-PIN eingeben)"
Write-Host "Denselben Test-PIN in GitHub als Secret STAGE_PIN eintragen."
