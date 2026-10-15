param([string]$TextFile, [int]$DelayMs = 35)
. "$PSScriptRoot\common.ps1"
[void][W]::SetProcessDPIAware()
$text = ([IO.File]::ReadAllText($TextFile, [Text.Encoding]::UTF8)) -replace "`r`n", "`n"
Start-Process notepad.exe
if (-not (Wait-Fg '^notepad$' 12)) { Write-Output 'ABORT:無法開啟記事本'; exit 0 }
Start-Sleep -Milliseconds 900
$i = 0
foreach ($c in $text.ToCharArray()) {
  if (Test-Esc) { Write-Output 'ABORT:你按了 Esc，已停止'; exit 0 }
  if (($i % 12) -eq 0 -and -not ((Get-FgName) -match '^notepad$')) { Write-Output 'ABORT:焦點離開記事本，已停止輸入'; exit 0 }
  if ($c -eq "`n") { [W]::Vk(0x0D) } elseif ($c -eq "`t") { [W]::Vk(0x09) } else { [W]::TypeChar($c) }
  Start-Sleep -Milliseconds ($DelayMs + (Get-Random -Maximum 25))
  $i++
}
Write-Output 'OK'
