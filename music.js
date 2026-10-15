// 音樂辨識：AudD（使用者自備 token）。錄音由 renderer 完成後傳 ArrayBuffer 進來。
const settings = require('./settings');
async function recognize(buf, mime) {
  const token = settings.getKey('audd');
  if (!token) return { ok: false, error: '請先在設定填入 AudD API Token' };
  try {
    const fd = new FormData();
    fd.append('api_token', token);
    fd.append('return', 'spotify,apple_music');
    fd.append('file', new Blob([Buffer.from(buf)], { type: mime || 'audio/webm' }), 'clip.webm');
    const res = await fetch('https://api.audd.io/', { method: 'POST', body: fd });
    const j = await res.json();
    if (j.status !== 'success') return { ok: false, error: j.error?.error_message || '辨識服務回傳錯誤' };
    if (!j.result) return { ok: true, found: false };
    return { ok: true, found: true, title: j.result.title, artist: j.result.artist, album: j.result.album, link: j.result.song_link };
  } catch (e) { return { ok: false, error: '辨識失敗：' + e.message }; }
}
module.exports = { recognize };
