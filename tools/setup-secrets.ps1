# BringFrisch: alle Zugangsdaten Schritt für Schritt einrichten – du tippst, das Skript speichert.
#   powershell -ExecutionPolicy Bypass -File tools\setup-secrets.ps1
#
# Grundsatz: Kein Wert wird angezeigt, gespeichert oder in eine Datei geschrieben. Alles läuft über
# Variablen in diesem Fenster und geht direkt an GitHub (gh secret set) bzw. Cloudflare (wrangler secret put).
# Am Schluss werden die Variablen gelöscht. Auch Claude bekommt nichts davon zu sehen.
#
# Was eingerichtet wird (jeder Schritt kann übersprungen werden):
#   1. GitHub-Anmeldung (gh)                         – damit das Skript GitHub-Secrets setzen darf
#   2. CLOUDFLARE_ACCOUNT_ID  -> GitHub              – automatisch aus «wrangler whoami», nie angezeigt
#   3. CLOUDFLARE_API_TOKEN   -> GitHub              – du erstellst ihn im Browser und fügst ihn verdeckt ein
#   4. Test-Server: Bot-Zugang + Test-PIN -> Cloudflare (stage), Test-PIN auch -> GitHub (STAGE_PIN)
#   Nur das Bot-Passwort des Test-Servers neu setzen:  … setup-secrets.ps1 -BotPassword
#   Nur die Account-ID neu setzen (ohne Eingabe):       … setup-secrets.ps1 -AccountId
#   Alles von Grund auf neu (Token, Bot, PINs, beide Server, Test-Lauf): … setup-secrets.ps1 -Neu
param([string]$Repo = 'jodbaer/BringFresch', [switch]$BotPassword, [switch]$AccountId, [switch]$Neu,
      [string]$BotMail = 'allmenbot@gmail.com')

$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') + ';C:\Program Files\nodejs;C:\Program Files\GitHub CLI'
$root = Split-Path $PSScriptRoot -Parent

function Step($n, $text) { Write-Host "`n=== Schritt ${n}: $text ===" -ForegroundColor Cyan }
function Ok($text) { Write-Host "  OK  $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  !!  $text" -ForegroundColor Yellow }
function Ask($q) { (Read-Host "  $q [J/n]") -notmatch '^(n|nein|no)$' }
function Hidden($q) {
  $s = Read-Host "  $q (wird nicht angezeigt)" -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}
# Wert über die Standardeingabe weitergeben (ohne Zeilenumbruch) – nie als Argument, nie angezeigt
function WithStdin($file, $arguments, $value, $dir) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $file; $psi.Arguments = $arguments; $psi.WorkingDirectory = $dir
  $psi.UseShellExecute = $false; $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
  # Ohne das setzt Windows PowerShell bei UTF-8-Konsolen 3 unsichtbare Bytes (BOM) vor den Wert -> Passwort/PIN/Token «falsch»
  $oldEnc = [Console]::InputEncoding
  try { [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}
  try { $p = [System.Diagnostics.Process]::Start($psi) } finally { try { [Console]::InputEncoding = $oldEnc } catch {} }
  $p.StandardInput.Write($value); $p.StandardInput.Close()
  $null = $p.StandardOutput.ReadToEnd(); $null = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  return $p.ExitCode
}
function GhSecret($name, $value) {
  $code = WithStdin (Get-Command gh).Source "secret set $name --repo $Repo" $value $root
  if ($code -eq 0) { Ok "GitHub-Secret $name gesetzt" } else { Warn "GitHub-Secret $name FEHLER" }
}
function CfSecret($name, $value, $envName) {
  # $envName leer = WG-Server (bringfrisch), sonst z.B. 'stage'
  $envArg = if ($envName) { " --env $envName" } else { '' }
  $label = if ($envName) { $envName } else { 'WG-Server' }
  $code = WithStdin 'cmd.exe' "/c npx --yes wrangler secret put $name$envArg" $value (Join-Path $root 'worker')
  if ($code -eq 0) { Ok "Cloudflare-Secret $name ($label) gesetzt" } else { Warn "Cloudflare-Secret $name ($label) FEHLER" }
}
function AskNo($q) { (Read-Host "  $q [j/N]") -match '^(j|ja|y|yes)$' }
function RandomToken { -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ }) }
# Bot-Zugang direkt bei Bring! ausprobieren (nichts wird angezeigt). Gibt die Listen-Namen zurück oder $null.
function BringCheck($mail, $pw) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $h = @{ 'X-BRING-API-KEY' = 'cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp'; 'X-BRING-CLIENT' = 'webApp'; 'X-BRING-CLIENT-SOURCE' = 'webApp'; 'X-BRING-COUNTRY' = 'CH' }
  try {
    $r = Invoke-RestMethod -Method Post -Uri 'https://api.getbring.com/rest/v2/bringauth' -Headers $h -Body @{ email = $mail; password = $pw } -ContentType 'application/x-www-form-urlencoded'
    if (-not $r.access_token) { return $null }
    $h['Authorization'] = "Bearer $($r.access_token)"; $h['X-BRING-USER-UUID'] = $r.uuid
    $l = Invoke-RestMethod -Uri "https://api.getbring.com/rest/v2/bringusers/$($r.uuid)/lists" -Headers $h
    return @{ lists = @($l.lists | ForEach-Object { $_.name }) }
  } catch { return $null }
}

if ($AccountId) {
  Push-Location (Join-Path $root 'worker')
  try { $who = (npx --yes wrangler whoami 2>$null | Out-String) } finally { Pop-Location }
  $ids = @([regex]::Matches($who, '[0-9a-f]{32}') | ForEach-Object { $_.Value } | Select-Object -Unique)
  if ($ids.Count -eq 1 -and $ids[0].Length -eq 32) { GhSecret 'CLOUDFLARE_ACCOUNT_ID' $ids[0] } else { Warn "Account-ID nicht eindeutig gefunden ($($ids.Count))" }
  Remove-Variable who, ids -ErrorAction SilentlyContinue
  return
}
if ($Neu) {
  # Alles von Grund auf neu. Kein Wert wird angezeigt oder gespeichert.
  Write-Host 'BringFrisch – alle Zugänge neu einrichten. Nichts von dem, was du eingibst, wird angezeigt oder gespeichert.' -ForegroundColor Cyan

  Step 1 'Anmeldungen am PC (GitHub + Cloudflare)'
  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host '  GitHub-Anmeldung öffnet sich im Browser …'; gh auth login --hostname github.com --git-protocol https --web }
  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Warn 'nicht bei GitHub angemeldet – Abbruch'; return }
  Ok 'GitHub'
  Push-Location (Join-Path $root 'worker')
  try {
    $who = (npx --yes wrangler whoami 2>$null | Out-String)
    if ($who -notmatch '[0-9a-f]{32}') { Write-Host '  Cloudflare-Anmeldung öffnet sich im Browser …'; npx --yes wrangler login | Out-Null; $who = (npx --yes wrangler whoami 2>$null | Out-String) }
  } finally { Pop-Location }
  $ids = @([regex]::Matches($who, '[0-9a-f]{32}') | ForEach-Object { $_.Value } | Select-Object -Unique)
  if ($ids.Count -ne 1) { Warn "Cloudflare-Konto nicht eindeutig ($($ids.Count)) – Abbruch"; return }
  Ok 'Cloudflare'

  Step 2 'Cloudflare Account-ID -> GitHub (automatisch)'
  GhSecret 'CLOUDFLARE_ACCOUNT_ID' $ids[0]
  Remove-Variable who, ids -ErrorAction SilentlyContinue

  Step 3 'Neuer Cloudflare API-Token -> GitHub'
  Write-Host '  Im Browser (öffnet sich gleich):'
  Write-Host '    1. Alten «Edit Cloudflare Workers»-Token löschen (falls vorhanden, «…» -> Delete)'
  Write-Host '    2. «Create Token» -> Vorlage «Edit Cloudflare Workers» -> «Use template»'
  Write-Host '    3. Account Resources: dein Konto · Zone Resources: «All zones»'
  Write-Host '    4. «Continue to summary» -> «Create Token» -> «Copy»'
  Start-Process 'https://dash.cloudflare.com/profile/api-tokens'
  do { $tok = (Hidden 'Token einfügen').Trim(); if (-not $tok) { Warn 'leer – bitte einfügen' } } until ($tok)
  GhSecret 'CLOUDFLARE_API_TOKEN' $tok
  Remove-Variable tok -ErrorAction SilentlyContinue

  Step 4 "Bring!-Bot ($BotMail)"
  Write-Host '  Tipp: Passwort vergessen? In der Bring!-App/Web mit dem Bot-Konto «Passwort vergessen» -> neues setzen, dann hier eingeben.'
  $lists = $null
  do {
    $pw = Hidden "Passwort von $BotMail"
    $pw2 = Hidden 'Nochmals, zur Kontrolle'
    if ($pw -cne $pw2) { Warn 'die beiden Eingaben sind verschieden – bitte nochmals'; continue }
    Write-Host '  prüfe direkt bei Bring! …'
    $check = BringCheck $BotMail $pw
    if ($check) { $lists = $check.lists; Ok "Bring! nimmt das Passwort an. Listen: $($lists -join ', ')" }
    else { Warn 'Bring! lehnt ab (Passwort falsch?) – bitte nochmals'; if (-not (Ask 'Nochmals versuchen?')) { Remove-Variable pw, pw2; return } }
  } until ($check)
  if ($lists -notcontains 'Home') { Warn 'Liste «Home» fehlt im Bot-Konto – der Test-Server braucht sie (in Bring! anlegen).' }
  CfSecret 'BRING_EMAIL' $BotMail 'stage'
  CfSecret 'BRING_PASSWORD' $pw 'stage'
  CfSecret 'BRING_EMAIL' $BotMail ''
  CfSecret 'BRING_PASSWORD' $pw ''
  Remove-Variable pw, pw2, check -ErrorAction SilentlyContinue

  Step 5 'Test-PIN (nur Test-Server, nicht der WG-PIN)'
  do { $pin = (Hidden 'Neuer Test-PIN').Trim(); $pin2 = (Hidden 'Nochmals').Trim() } until ($pin -and $pin -ceq $pin2)
  CfSecret 'WG_PIN' $pin 'stage'
  GhSecret 'STAGE_PIN' $pin
  CfSecret 'CAL_TOKEN' (RandomToken) 'stage'
  Remove-Variable pin, pin2 -ErrorAction SilentlyContinue

  Step 6 'WG-Server: PIN und Kalender-Link'
  Write-Host '  Neuer WG-PIN = alle in der WG müssen ihn im Handy neu eingeben.'
  if (AskNo 'WG-PIN neu setzen?') {
    do { $pin = (Hidden 'Neuer WG-PIN').Trim(); $pin2 = (Hidden 'Nochmals').Trim() } until ($pin -and $pin -ceq $pin2)
    CfSecret 'WG_PIN' $pin ''
    Remove-Variable pin, pin2 -ErrorAction SilentlyContinue
  } else { Ok 'WG-PIN bleibt' }
  Write-Host '  Neuer Kalender-Link = alle müssen den Kalender neu abonnieren.'
  if (AskNo 'Kalender-Link neu machen?') { CfSecret 'CAL_TOKEN' (RandomToken) '' } else { Ok 'Kalender-Link bleibt' }
  [GC]::Collect()

  Step 7 'Test-Version neu starten (Tests + Test-Server + Bring! «Home»), ca. 7 Minuten'
  gh workflow run stage.yml --repo $Repo --ref main
  Start-Sleep -Seconds 10
  $id = (gh run list --repo $Repo --workflow stage.yml --limit 1 --json databaseId --jq '.[0].databaseId')
  gh run watch $id --repo $Repo --exit-status | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok 'alles grün – Anmeldung funktioniert wieder' }
  else { Warn "noch rot – schreib Claude «Lauf $id ist rot»" }
  Write-Host "`nDer WG-Server hat das neue Bot-Passwort schon jetzt (kein Release nötig)." -ForegroundColor Cyan
  return
}
if ($BotPassword) {
  Step 1 'Bot-Passwort des Test-Servers neu setzen'
  $pw = Hidden 'Passwort des Bring!-Bots'
  $pw2 = Hidden 'Nochmals, zur Kontrolle'
  if (-not $pw) { Warn 'leer – nichts geändert' }
  elseif ($pw -cne $pw2) { Warn 'die beiden Eingaben sind verschieden – nichts geändert, bitte nochmals starten' }
  else { CfSecret 'BRING_PASSWORD' $pw 'stage' }
  Remove-Variable pw, pw2 -ErrorAction SilentlyContinue
  [GC]::Collect()
  Write-Host "`nFertig. Schreib Claude «fertig» – dann wird der Test gegen Bring! «Home» nochmals gestartet." -ForegroundColor Cyan
  return
}

Write-Host "BringFrisch – Zugangsdaten einrichten (Repo: $Repo)" -ForegroundColor Cyan
Write-Host "Nichts von dem, was du eingibst, wird angezeigt oder gespeichert."

# ---------------------------------------------------------------- 1. GitHub
Step 1 'GitHub-Anmeldung'
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Warn 'GitHub CLI (gh) fehlt.'
  if (Ask 'Jetzt installieren (winget install GitHub.cli)?') {
    winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements | Out-Null
    $env:Path += ';C:\Program Files\GitHub CLI'
  }
}
$haveGh = [bool](Get-Command gh -ErrorAction SilentlyContinue)
if ($haveGh) {
  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host '  Gleich öffnet sich die GitHub-Anmeldung (Browser). Dort bestätigen, dann hierher zurück.'
    gh auth login --hostname github.com --git-protocol https --web
  }
  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok 'bei GitHub angemeldet' } else { Warn 'nicht angemeldet – GitHub-Schritte werden übersprungen'; $haveGh = $false }
} else { Warn 'ohne gh werden die GitHub-Secrets übersprungen' }

# ---------------------------------------------------------------- 2. Account-ID
Step 2 'Cloudflare Account-ID -> GitHub (automatisch, wird nicht angezeigt)'
if ($haveGh -and (Ask 'CLOUDFLARE_ACCOUNT_ID setzen?')) {
  Push-Location (Join-Path $root 'worker')
  try { $who = (npx --yes wrangler whoami 2>$null | Out-String) } finally { Pop-Location }
  if ($who -notmatch '[0-9a-f]{32}') {
    Write-Host '  Nicht bei Cloudflare angemeldet – gleich öffnet sich die Cloudflare-Anmeldung.'
    Push-Location (Join-Path $root 'worker'); try { npx --yes wrangler login | Out-Null; $who = (npx --yes wrangler whoami 2>$null | Out-String) } finally { Pop-Location }
  }
  # @(...): auch bei genau einem Treffer eine Liste (sonst wäre $ids[0] nur das erste Zeichen)
  $ids = @([regex]::Matches($who, '[0-9a-f]{32}') | ForEach-Object { $_.Value } | Select-Object -Unique)
  if ($ids.Count -eq 1) { GhSecret 'CLOUDFLARE_ACCOUNT_ID' $ids[0] }
  elseif ($ids.Count -gt 1) { Warn "$($ids.Count) Cloudflare-Konten gefunden – Account-ID bitte selbst einfügen"; GhSecret 'CLOUDFLARE_ACCOUNT_ID' (Hidden 'Account-ID') }
  else { Warn 'keine Account-ID gefunden' }
  Remove-Variable who, ids -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------- 3. API-Token
Step 3 'Cloudflare API-Token -> GitHub'
if ($haveGh -and (Ask 'CLOUDFLARE_API_TOKEN setzen?')) {
  Write-Host '  So geht es (Browser öffnet sich gleich):'
  Write-Host '    1. «Create Token»'
  Write-Host '    2. Vorlage «Edit Cloudflare Workers» -> «Use template»'
  Write-Host '    3. Account Resources: dein Konto · Zone Resources: «All zones» (oder leer lassen)'
  Write-Host '    4. «Continue to summary» -> «Create Token» -> Token kopieren'
  Start-Process 'https://dash.cloudflare.com/profile/api-tokens'
  $tok = Hidden 'Token hier einfügen'
  if ($tok) { GhSecret 'CLOUDFLARE_API_TOKEN' $tok } else { Warn 'leer – übersprungen' }
  Remove-Variable tok -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------- 4. Test-Server
Step 4 'Test-Server (schreibt nur in die Bring!-Liste «Home» des Bots)'
if (Ask 'Test-Server einrichten (Bot-Zugang + Test-PIN)?') {
  $mail = Hidden 'E-Mail des Bring!-Bots'
  $pw = Hidden 'Passwort des Bring!-Bots'
  $pin = Hidden 'Neuer Test-PIN (nicht der WG-PIN)'
  $cal = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
  if ($mail) { CfSecret 'BRING_EMAIL' $mail 'stage' }
  if ($pw) { CfSecret 'BRING_PASSWORD' $pw 'stage' }
  if ($pin) { CfSecret 'WG_PIN' $pin 'stage'; if ($haveGh) { GhSecret 'STAGE_PIN' $pin } }
  CfSecret 'CAL_TOKEN' $cal 'stage'
  Remove-Variable mail, pw, pin, cal -ErrorAction SilentlyContinue
}

[GC]::Collect()
Write-Host "`nFertig. Nächster Push auf main aktualisiert die Test-Version, der nächste Release-Tag auch den WG-Server." -ForegroundColor Cyan
Write-Host 'Kontrolle (zeigt nur die Namen, nie die Werte): gh secret list --repo ' $Repo
