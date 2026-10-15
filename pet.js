const $ = (s) => document.querySelector(s);
const pet = $('#pet'), body = $('.body'), bubble = $('#bubble'), menu = $('#menu'), cmd = $('#cmd'), chip = $('#chip');
const M = window.mascot;

// ============ 1. 點擊穿透：只有滑鼠在 .hit 元素上才攔截 ============
let dragging = false, catching = false;
function setCatch(on) { if (on !== catching) { catching = on; M.setIgnoreMouse(!on); } }
document.addEventListener('mousemove', e => { if (!dragging) setCatch(!!e.target.closest('.hit')); });

// ============ 2. 拖曳：彈簧追游標 + 慣性 + 邊緣反彈 + Q 彈變形 ============
const K = 0.18, DAMP = 0.72, FRICTION = 0.92, BOUNCE = 0.6;
let st = null, downAt = null;
pet.addEventListener('pointerdown', async (e) => {
  pet.setPointerCapture(e.pointerId);
  downAt = { x: e.screenX, y: e.screenY, t: performance.now(), moved: false };
  const { bounds, workArea } = await M.getBounds();
  st = { x: bounds.x, y: bounds.y, vx: 0, vy: 0, tx: bounds.x, ty: bounds.y, ox: e.screenX - bounds.x, oy: e.screenY - bounds.y, area: workArea, w: bounds.width, h: bounds.height, held: true };
  dragging = true; pet.classList.add('dragging'); requestAnimationFrame(tick);
});
pet.addEventListener('pointermove', (e) => {
  if (!st?.held) return;
  if (Math.hypot(e.screenX - downAt.x, e.screenY - downAt.y) > 5) downAt.moved = true;
  st.tx = e.screenX - st.ox; st.ty = e.screenY - st.oy;
});
const release = () => {
  if (!st) return;
  st.held = false; dragging = false; pet.classList.remove('dragging');
  if (downAt && !downAt.moved && performance.now() - downAt.t < 400) toggleMenu();   // 輕點 = 開關選單
};
pet.addEventListener('pointerup', release); pet.addEventListener('pointercancel', release);

function tick() {
  if (!st) return;
  const a = st.area;
  if (st.held) { st.vx = (st.vx + (st.tx - st.x) * K) * DAMP; st.vy = (st.vy + (st.ty - st.y) * K) * DAMP; }
  else { st.vx *= FRICTION; st.vy *= FRICTION; }
  st.x += st.vx; st.y += st.vy;
  // 寵物在視窗底部置中（寬 140、離底 24~154），讓「寵物本體」可以碰到螢幕邊緣
  const minX = a.x - (st.w / 2 - 70), maxX = a.x + a.width - (st.w / 2 + 70);
  const minY = a.y - (st.h - 154), maxY = a.y + a.height - st.h + 24;
  if (st.x < minX) { st.x = minX; st.vx = Math.abs(st.vx) * BOUNCE; }
  if (st.x > maxX) { st.x = maxX; st.vx = -Math.abs(st.vx) * BOUNCE; }
  if (st.y < minY) { st.y = minY; st.vy = Math.abs(st.vy) * BOUNCE; }
  if (st.y > maxY) { st.y = maxY; st.vy = -Math.abs(st.vy) * BOUNCE; }
  M.moveWindow(st.x, st.y);
  const speed = Math.hypot(st.vx, st.vy), stretch = Math.min(speed / 60, 0.25);
  body.style.transform = `rotate(${Math.max(-18, Math.min(18, st.vx * 0.8))}deg) scale(${1 - stretch * 0.5},${1 + stretch})`;
  if (st.held || speed > 0.15) return requestAnimationFrame(tick);
  body.style.transform = ''; st = null;
  body.animate([{ transform: 'scale(1.18,.82)' }, { transform: 'scale(.94,1.08)' }, { transform: 'scale(1.04,.97)' }, { transform: 'scale(1,1)' }], { duration: 520, easing: 'ease-out' });
}

// ============ 3. 對話框 + 打字機 + 情緒 ============
const MOODS = ['idle', 'focus', 'happy', 'taunt', 'sleepy'];
let typing, hideTimer;
function say(text, mood = 'idle', ms = 5000, link = null) {
  pet.dataset.mood = MOODS.includes(mood) ? mood : 'idle';
  clearInterval(typing); clearTimeout(hideTimer);
  bubble.classList.remove('hidden'); bubble.textContent = ''; bubble.dataset.link = link || '';
  let i = 0;
  typing = setInterval(() => {
    bubble.textContent = text.slice(0, ++i); bubble.scrollTop = bubble.scrollHeight;
    if (i >= text.length) { clearInterval(typing); hideTimer = setTimeout(hideBubble, ms); }
  }, 30);
}
function hideBubble() { bubble.classList.add('hidden'); if (!busy) pet.dataset.mood = 'idle'; }
bubble.addEventListener('click', () => { if (bubble.dataset.link) M.openExternal(bubble.dataset.link); else hideBubble(); });

// ============ 4. 選單 ============
function toggleMenu(force) {
  const open = force ?? menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !open);
  if (open) cmd.focus(); else setCatch(false);
}
addEventListener('keydown', e => { if (e.key === 'Escape') toggleMenu(false); });
cmd.addEventListener('keydown', e => { if (e.key === 'Enter' && cmd.value.trim()) { const t = cmd.value.trim(); cmd.value = ''; toggleMenu(false); run('text', t); } });
menu.addEventListener('click', e => {
  const act = e.target.closest('button')?.dataset.act; if (!act) return;
  if (act === 'settings') return M.openSettings();
  if (act === 'game') return toggleGame();
  if (act === 'pomo') return togglePomo();
  if (act === 'music') { toggleMenu(false); return recognizeMusic(); }
  if (act === 'reverse') { toggleMenu(false); return reverseSearch(); }
  toggleMenu(false); run(act, cmd.value.trim());     // full / region / file（輸入框的文字當作補充說明）
});

// ============ 5. 解題 / 對話 ============
let busy = false;
async function run(kind, note) {
  if (busy) return say('我還在忙上一題，等我一下～', 'focus', 2500);
  busy = true;
  try {
    let image = null;
    if (kind !== 'text') {
      say(kind === 'region' ? '拖曳框選題目範圍～' : '收到，讀題中…', 'focus', 20000);
      const c = await M.capture(kind);
      if (!c.ok) return say('截圖失敗：' + c.error, 'sleepy', 8000);
      if (!c.dataUrl) return say('沒有拿到圖片，再試一次吧', 'idle', 3000);
      image = c.dataUrl;
    }
    say('讓我想想…', 'focus', 120000);
    const res = await M.ask({ text: note || '', images: image ? [image] : [], newSession: true });
    if (!res.ok) return say('糟糕：' + res.error, 'sleepy', 12000);
    const d = res.data;
    say(d.final_answer ? '解出來啦！答案：' + d.final_answer : '整理好了，看看解答視窗～', d.mood, 6000);
    M.showAnswer({ data: d, image });
  } finally { busy = false; }
}
M.onShortcutSolve(() => run('region', ''));

async function reverseSearch() {
  const c = await M.capture('region');
  if (!c.ok || !c.dataUrl) return;
  const r = await M.reverseSearch('lens');
  say(r.message, 'happy', 8000);
}

// ============ 6. 遊戲觀戰 ============
let gameOn = false, gameTimer = null;
async function toggleGame() {
  gameOn = !gameOn; $('#b-game').textContent = '🎮 遊戲觀戰：' + (gameOn ? '開' : '關'); $('#b-game').classList.toggle('on', gameOn);
  clearTimeout(gameTimer);
  if (!gameOn) return say('好，我不看了。想看再叫我～', 'idle', 3000);
  say('開始觀戰！我會偷偷看你的螢幕（約每幾十秒一次）👀', 'focus', 5000);
  gameLoop();
}
async function gameLoop() {
  if (!gameOn) return;
  const s = await M.getSettings();
  if (!busy) {
    const r = await M.gameTick();
    if (!r.ok) { gameOn = false; $('#b-game').textContent = '🎮 遊戲觀戰：關'; $('#b-game').classList.remove('on'); return say('觀戰中斷：' + r.error, 'sleepy', 12000); }
    if (r.comment) say(r.comment, r.mood, 7000);
  }
  gameTimer = setTimeout(gameLoop, s.gameInterval * 1000);
}

// ============ 7. 番茄鐘 ============
let pomo = null, pomoTick = null;
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function beep() { try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); g.gain.value = .08; o.frequency.value = 880; o.start(); o.stop(c.currentTime + .25); } catch {} }
async function togglePomo() {
  if (pomo) { pomo = null; clearInterval(pomoTick); chip.classList.add('hidden'); $('#b-pomo').textContent = '🍅 番茄鐘：關'; $('#b-pomo').classList.remove('on'); return say('番茄鐘停了。', 'idle', 2500); }
  const s = await M.getSettings();
  startPhase('focus', s.pomodoro);
  $('#b-pomo').textContent = '🍅 番茄鐘：開'; $('#b-pomo').classList.add('on');
  pomoTick = setInterval(() => {
    chip.textContent = (pomo.phase === 'focus' ? '專注 ' : '休息 ') + fmt(pomo.end - Date.now());
    if (Date.now() >= pomo.end) {
      beep();
      if (pomo.phase === 'focus') { say(`專注 ${pomo.cfg.focus} 分鐘完成！起來動一動、喝口水吧～`, 'sleepy', 9000); startPhase('rest', pomo.cfg, true); }
      else { say('休息結束，回來開工囉！', 'focus', 6000); startPhase('focus', pomo.cfg, true); }
    }
  }, 500);
}
function startPhase(phase, cfg, keep) {
  pomo = { phase, cfg, end: Date.now() + (phase === 'focus' ? cfg.focus : cfg.rest) * 60000 };
  chip.classList.remove('hidden'); chip.textContent = fmt(pomo.end - Date.now());
  if (!keep) say(`開始專注 ${cfg.focus} 分鐘，我陪你！`, 'focus', 4000);
}

// ============ 8. 音樂辨識 ============
async function getAudio(source) {
  if (source === 'mic') return navigator.mediaDevices.getUserMedia({ audio: true });
  const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  s.getVideoTracks().forEach(t => t.stop());
  if (!s.getAudioTracks().length) throw new Error('抓不到系統聲音（僅 Windows 支援；也可到設定改用麥克風）');
  return new MediaStream(s.getAudioTracks());
}
async function recognizeMusic() {
  const s = await M.getSettings();
  if (!s.hasKey.audd) { say('先到設定填入 AudD Token，我才聽得懂音樂～', 'idle', 5000); return M.openSettings(); }
  try {
    say('豎起耳朵聽 12 秒…🎧', 'focus', 15000);
    const stream = await getAudio(s.audioSource);
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' }), chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    const done = new Promise(r => rec.onstop = r);
    rec.start(); setTimeout(() => rec.stop(), 12000); await done;
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const r = await M.recognizeMusic(await blob.arrayBuffer(), blob.type);
    if (!r.ok) return say(r.error, 'sleepy', 9000);
    if (!r.found) return say('這首我沒聽出來…換個更清楚的片段再試試？', 'sleepy', 6000);
    say(`🎵 ${r.title} — ${r.artist}${r.link ? '（點我開啟連結）' : ''}`, 'happy', 12000, r.link);
  } catch (e) { say('辨識失敗：' + e.message, 'sleepy', 9000); }
}

// ============ 啟動 ============
M.getSettings().then(s => say(s.hasKey.openai || s.hasKey.gemini || s.hasKey.claude ? '我上線啦～輕點我打開選單！' : '第一次見面！先到設定貼上 API Key 吧', 'happy', 5000));
