if (-not ('W' -as [type])) {
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] i, int size);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct IU { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public IU U; }
  static void Key(ushort vk, ushort scan, uint flags) {
    INPUT[] a = new INPUT[1]; a[0].type = 1;
    a[0].U.ki.wVk = vk; a[0].U.ki.wScan = scan; a[0].U.ki.dwFlags = flags;
    SendInput(1, a, Marshal.SizeOf(typeof(INPUT)));
  }
  public static void TypeChar(char c) { Key(0, c, 4); Key(0, c, 6); }   // KEYEVENTF_UNICODE
  public static void Vk(ushort vk) { Key(vk, 0, 0); Key(vk, 0, 2); }
}
"@
}
function Get-FgName {
  $p = [uint32]0
  [void][W]::GetWindowThreadProcessId([W]::GetForegroundWindow(), [ref]$p)
  $x = Get-Process -Id $p -ErrorAction SilentlyContinue
  if ($x) { $x.ProcessName } else { '' }
}
function Wait-Fg($pattern, $sec) {
  $end = (Get-Date).AddSeconds($sec)
  while ((Get-Date) -lt $end) { if ((Get-FgName) -match $pattern) { return $true }; Start-Sleep -Milliseconds 200 }
  return $false
}
function Test-Esc { return (([W]::GetAsyncKeyState(0x1B) -band 0x8000) -ne 0) }   # 按 Esc 隨時中止
