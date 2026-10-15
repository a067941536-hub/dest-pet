// 系統自動化（僅 Windows）：用 PowerShell + SendInput，不需任何原生模組
const { app } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

function scriptsDir() {
  const dir = path.join(app.getPath('temp'), 'mascot-scripts');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['common.ps1', 'type-text.ps1', 'draw.ps1'])
    fs.copyFileSync(path.join(__dirname, '..', 'scripts', f), path.join(dir, f)); // asar 內也能讀
  return dir;
}
function run(script, args) {
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, message: '目前只支援 Windows（會用到小畫家與記事本）' });
  return new Promise(resolve => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File', path.join(scriptsDir(), script), ...args], { windowsHide: true });
    let out = '', err = '';
    ps.stdout.on('data', d => out += d); ps.stderr.on('data', d => err += d);
    const timer = setTimeout(() => ps.kill(), 5 * 60 * 1000);
    ps.on('close', () => {
      clearTimeout(timer);
      const last = out.trim().split(/\r?\n/).pop() || '';
      if (last === 'OK') resolve({ ok: true, message: '完成！' });
      else if (last.startsWith('ABORT:')) resolve({ ok: false, message: last.slice(6) });
      else resolve({ ok: false, message: '執行失敗：' + (err.trim().slice(0, 160) || last || '未知錯誤') });
    });
  });
}
function tmpFile(ext, content) {
  const f = path.join(os.tmpdir(), `mascot-${Date.now()}.${ext}`);
  fs.writeFileSync(f, content, 'utf8'); return f;
}
async function typeInNotepad(text) {
  const f = tmpFile('txt', String(text).slice(0, 20000));
  try { return await run('type-text.ps1', ['-TextFile', f]); } finally { fs.unlink(f, () => {}); }
}
async function drawInPaint(drawing) {
  const f = tmpFile('json', JSON.stringify({ paths: drawing.paths }));
  try { return await run('draw.ps1', ['-PathsFile', f]); } finally { fs.unlink(f, () => {}); }
}
module.exports = { typeInNotepad, drawInPaint };
