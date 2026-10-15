param([string]$PathsFile)
. "$PSScriptRoot\common.ps1"
[void][W]::SetProcessDPIAware()
# ===== 可調整：畫布位置（以 100% 縮放的像素計，若畫歪了改這三個數字）=====
$CANVAS_SIZE = 520   # 繪圖方框邊長
$OFFSET_X    = 60    # 距視窗左邊
$OFFSET_Y    = 230   # 距視窗上邊（要略過功能區）
# =====================================================================
$d = Get-Content -Raw -Encoding UTF8 $PathsFile | ConvertFrom-Json
Start-Process mspaint.exe
if (-not (Wait-Fg '^mspaint$' 15)) { Write-Output 'ABORT:無法開啟小畫家'; exit 0 }
$h = [W]::GetForegroundWindow()
[void][W]::ShowWindow($h, 3)           # 最大化，讓座標可預期
Start-Sleep -Milliseconds 1300
$dpi = [W]::GetDpiForWindow($h); if ($dpi -le 0) { $dpi = 96 }
$s = $dpi / 96.0
$r = New-Object W+RECT
[void][W]::GetWindowRect($h, [ref]$r)
$size = $CANVAS_SIZE * $s; $ox = $r.L + $OFFSET_X * $s; $oy = $r.T + $OFFSET_Y * $s
foreach ($p in $d.paths) {
  $pts = @($p.points)
  if ($pts.Count -lt 2) { continue }
  if (-not ((Get-FgName) -match '^mspaint$')) { Write-Output 'ABORT:焦點離開小畫家，已停止'; exit 0 }
  $px = [int]($ox + $pts[0][0] * $size); $py = [int]($oy + $pts[0][1] * $size)
  [void][W]::SetCursorPos($px, $py); Start-Sleep -Milliseconds 40
  [W]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)          # 左鍵按下
  for ($i = 1; $i -lt $pts.Count; $i++) {
    $nx = [int]($ox + $pts[$i][0] * $size); $ny = [int]($oy + $pts[$i][1] * $size)
    $dist = [Math]::Sqrt(($nx - $px) * ($nx - $px) + ($ny - $py) * ($ny - $py))
    $steps = [Math]::Max(1, [int][Math]::Ceiling($dist / 6))
    for ($k = 1; $k -le $steps; $k++) {
      if (Test-Esc) { [W]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero); Write-Output 'ABORT:你按了 Esc，已停止'; exit 0 }
      [void][W]::SetCursorPos([int]($px + ($nx - $px) * $k / $steps), [int]($py + ($ny - $py) * $k / $steps))
      Start-Sleep -Milliseconds 4
    }
    $px = $nx; $py = $ny
  }
  [W]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)          # 左鍵放開
  Start-Sleep -Milliseconds 120
}
Write-Output 'OK'
