const { desktopCapturer, screen, BrowserWindow, ipcMain } = require('electron');

async function displayImage(d) {
  const sf = d.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.size.width * sf), height: Math.round(d.size.height * sf) } });
  const s = sources.find(x => x.display_id === String(d.id)) || sources[0];
  if (!s) throw new Error('抓不到螢幕畫面（macOS 請到「系統設定 → 隱私權 → 螢幕錄製」授權）');
  return s.thumbnail;
}
const cursorDisplay = () => screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
// 寵物視窗有 setContentProtection(true)，不會出現在截圖裡
const full = () => displayImage(cursorDisplay());

async function region(preload, htmlPath) {
  const d = cursorDisplay();
  const shot = await displayImage(d);               // 先截圖，再開選取遮罩
  const ov = new BrowserWindow({ ...d.bounds, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: false, movable: false, hasShadow: false, webPreferences: { preload, contextIsolation: true } });
  ov.setAlwaysOnTop(true, 'screen-saver');
  await ov.loadFile(htmlPath); ov.focus();
  const rect = await new Promise(resolve => {
    ipcMain.once('region:done', (_e, r) => resolve(r));
    ov.once('closed', () => resolve(null));
  });
  ipcMain.removeAllListeners('region:done');
  if (!ov.isDestroyed()) ov.close();
  if (!rect || rect.w < 8 || rect.h < 8) return null;
  const sf = d.scaleFactor || 1;
  return shot.crop({ x: Math.round(rect.x * sf), y: Math.round(rect.y * sf), width: Math.round(rect.w * sf), height: Math.round(rect.h * sf) });
}
module.exports = { full, region };
