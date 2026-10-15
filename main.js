const { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage, session, shell, dialog, clipboard, desktopCapturer } = require('electron');
const path = require('path');
const settings = require('./services/settings');
const ai = require('./services/ai');
const capture = require('./services/capture');
const automation = require('./services/automation');
const music = require('./services/music');
const { toDataUrl } = require('./services/img');

const PRELOAD = path.join(__dirname, 'preload.js');
const R = (f) => path.join(__dirname, f);
const WIN_W = 420, WIN_H = 600;
let pet, answerWin, settingsWin, tray, lastImage = null;

if (!app.requestSingleInstanceLock()) app.quit();

// 只允許 https 外部連結
function openSafe(url) { try { if (new URL(url).protocol === 'https:') shell.openExternal(url); } catch {} }
function lockNavigation(win) {
  win.webContents.setWindowOpenHandler(({ url }) => { openSafe(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); openSafe(url); } });
}

function createPet() {
  const { workArea } = screen.getPrimaryDisplay();
  pet = new BrowserWindow({
    width: WIN_W, height: WIN_H,
    x: workArea.x + workArea.width - WIN_W - 30, y: workArea.y + workArea.height - WIN_H + 10,
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    resizable: false, maximizable: false, skipTaskbar: true, alwaysOnTop: true,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  pet.setAlwaysOnTop(true, 'screen-saver');
  pet.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pet.setContentProtection(true);                       // 寵物不會被截圖/觀戰擷取到
  pet.setIgnoreMouseEvents(true, { forward: true });    // 預設點擊穿透
  pet.loadFile(R('index.html'));
  lockNavigation(pet);
}

function openAnswer(payload) {
  const send = () => answerWin.webContents.send('answer:data', payload);
  if (!answerWin || answerWin.isDestroyed()) {
    answerWin = new BrowserWindow({ width: 580, height: 760, title: '小糰的解答', alwaysOnTop: true, autoHideMenuBar: true, webPreferences: { preload: PRELOAD, contextIsolation: true } });
    answerWin.setMenu(null); lockNavigation(answerWin);
    answerWin.loadFile(R('answer.html'));
    answerWin.webContents.once('did-finish-load', send);
  } else { answerWin.show(); answerWin.focus(); send(); }
}
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); return settingsWin.focus(); }
  settingsWin = new BrowserWindow({ width: 700, height: 820, title: '小糰設定', autoHideMenuBar: true, webPreferences: { preload: PRELOAD, contextIsolation: true } });
  settingsWin.setMenu(null); lockNavigation(settingsWin);
  settingsWin.loadFile(R('settings.html'));
}

// ---------- 視窗控制 ----------
ipcMain.on('win:set-ignore-mouse', (_e, ignore) => pet.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : undefined));
ipcMain.handle('win:get-bounds', () => ({ bounds: pet.getBounds(), workArea: screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea }));
ipcMain.on('win:move', (_e, x, y) => pet.setBounds({ x: Math.round(x), y: Math.round(y), width: WIN_W, height: WIN_H }));
ipcMain.on('app:quit', () => app.quit());
ipcMain.on('region:done', () => {});                    // 實際接收在 capture.region()

// ---------- 設定 / 金鑰 ----------
ipcMain.handle('settings:get', () => settings.view());
ipcMain.handle('settings:set', (_e, patch) => { const v = settings.update(patch); pet?.webContents.send('settings:changed', v); return v; });
ipcMain.handle('ai:test', (_e, provider) => ai.test(provider));
ipcMain.handle('settings:open', () => openSettings());
ipcMain.handle('shell:open', (_e, url) => openSafe(url));

// ---------- 截圖 / AI ----------
ipcMain.handle('capture:run', async (_e, kind) => {
  try {
    let img;
    if (kind === 'full') img = await capture.full();
    else if (kind === 'region') img = await capture.region(PRELOAD, R('region.html'));
    else if (kind === 'file') {
      const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: '圖片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }] });
      if (r.canceled) return { ok: true, dataUrl: null };
      img = nativeImage.createFromPath(r.filePaths[0]);
    }
    if (!img || img.isEmpty()) return { ok: true, dataUrl: null };
    lastImage = img;
    return { ok: true, dataUrl: toDataUrl(img, 1600) };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('ai:ask', (_e, p) => ai.ask(p));
ipcMain.handle('game:tick', async () => { try { return await ai.gameTick(await capture.full()); } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('answer:show', (_e, payload) => openAnswer(payload));

// ---------- 自動化 ----------
ipcMain.handle('auto:notepad', (_e, text) => automation.typeInNotepad(text));
ipcMain.handle('auto:paint', (_e, drawing) => automation.drawInPaint(drawing));

// ---------- 以圖搜圖：圖片放剪貼簿 + 開啟搜尋頁，使用者按 Ctrl+V ----------
const ENGINES = { lens: 'https://lens.google.com/', tineye: 'https://tineye.com/', yandex: 'https://yandex.com/images/', bing: 'https://www.bing.com/visualsearch' };
ipcMain.handle('search:reverse', (_e, engine) => {
  if (!lastImage || !ENGINES[engine]) return { ok: false, message: '還沒有可搜尋的圖片，先截圖或上傳一張吧' };
  clipboard.writeImage(lastImage); openSafe(ENGINES[engine]);
  return { ok: true, message: '圖片已複製！在搜尋頁面按 Ctrl+V（Mac 為 ⌘V）貼上即可' };
});

// ---------- 音樂辨識 ----------
ipcMain.handle('music:recognize', (_e, buf, mime) => music.recognize(buf, mime));

app.whenReady().then(() => {
  // 系統聲音（Windows loopback）與麥克風權限
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, cb) => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    cb({ video: sources[0], audio: 'loopback' });
  }, { useSystemPicker: false });
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(['media', 'display-capture'].includes(perm)));

  createPet();
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png')));
  tray.setToolTip('小糰 MascotAssistant');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '顯示 / 隱藏小糰', click: () => (pet.isVisible() ? pet.hide() : pet.show()) },
    { label: '設定（API Key 等）', click: openSettings },
    { type: 'separator' }, { label: '結束', click: () => app.quit() },
  ]));
  globalShortcut.register('CommandOrControl+Shift+Space', () => pet.webContents.send('shortcut:solve'));
  if (!settings.hasAnyKey()) openSettings();            // 第一次使用：直接帶去貼 API Key
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {});                  // 常駐托盤，不因關閉設定視窗而結束
