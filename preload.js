const { contextBridge, ipcRenderer: ipc } = require('electron');
const inv = (c, ...a) => ipc.invoke(c, ...a);
contextBridge.exposeInMainWorld('mascot', {
  // 視窗
  setIgnoreMouse: (v) => ipc.send('win:set-ignore-mouse', v),
  getBounds: () => inv('win:get-bounds'),
  moveWindow: (x, y) => ipc.send('win:move', x, y),
  quit: () => ipc.send('app:quit'),
  // 設定
  getSettings: () => inv('settings:get'),
  saveSettings: (p) => inv('settings:set', p),
  testProvider: (id) => inv('ai:test', id),
  openSettings: () => inv('settings:open'),
  openExternal: (u) => inv('shell:open', u),
  onSettingsChanged: (cb) => ipc.on('settings:changed', (_e, v) => cb(v)),
  // 功能
  capture: (kind) => inv('capture:run', kind),
  ask: (p) => inv('ai:ask', p),
  gameTick: () => inv('game:tick'),
  showAnswer: (p) => inv('answer:show', p),
  onAnswer: (cb) => ipc.on('answer:data', (_e, d) => cb(d)),
  notepad: (t) => inv('auto:notepad', t),
  paint: (d) => inv('auto:paint', d),
  reverseSearch: (e) => inv('search:reverse', e),
  recognizeMusic: (buf, mime) => inv('music:recognize', buf, mime),
  regionDone: (r) => ipc.send('region:done', r),
  onShortcutSolve: (cb) => ipc.on('shortcut:solve', cb),
});
