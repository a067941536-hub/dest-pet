const M = window.mascot;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PROVIDERS = [
  { id: 'openai', name: 'ChatGPT（OpenAI）', url: 'https://platform.openai.com/api-keys', ph: 'sk-...', models: ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-6-astra', 'chat-latest'],
    steps: ['開啟 <a href="#" data-open="https://platform.openai.com/api-keys">platform.openai.com/api-keys</a>，登入或註冊 OpenAI 帳號。', '按「Create new secret key」，取個名字（例如 MascotAssistant）後建立。', '<b>馬上複製</b>金鑰（只會顯示一次），貼到上方欄位。', '到 Billing 加入付款方式並儲值（小額即可），否則會回報額度不足。'],
    note: '注意：ChatGPT Plus / Pro 訂閱不含 API 額度，API 要另外在 platform 帳戶儲值計費。' },
  { id: 'gemini', name: 'Gemini（Google）', url: 'https://aistudio.google.com/apikey', ph: 'AIza...', models: ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'],
    steps: ['開啟 <a href="#" data-open="https://aistudio.google.com/apikey">aistudio.google.com/apikey</a>，用 Google 帳號登入。', '按「Create API key」，選擇一個專案（沒有的話會自動建立）。', '複製金鑰，貼到上方欄位。'],
    note: '有免費額度但有速率限制，頻繁的遊戲觀戰可能會超額；免費層級的資料使用方式請以 Google 官方條款為準，畫面含個資時建議改用付費方案。' },
  { id: 'claude', name: 'Claude（Anthropic）', url: 'https://platform.claude.com/settings/keys', ph: 'sk-ant-...', models: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
    steps: ['開啟 <a href="#" data-open="https://platform.claude.com/settings/keys">platform.claude.com/settings/keys</a>，登入或註冊 Claude Console。', '按「Create key」，命名後建立。', '<b>馬上複製</b>以 sk-ant- 開頭的金鑰（只顯示一次），貼到上方欄位。', '到 Settings → Billing 儲值（預付點數制）。'],
    note: '注意：Claude.ai 的 Pro / Max 訂閱不含 API 額度，API 另外儲值計費。' },
];
let S;
const $ = (s, r = document) => r.querySelector(s);
const toast = (t, err) => { const el = $('#toast'); el.textContent = t; el.className = 'toast' + (err ? ' err' : ''); };

function render() {
  $('#providers').innerHTML = PROVIDERS.map(p => `<section class="card" data-p="${p.id}">
    <header><label><input type="radio" name="provider" value="${p.id}" ${S.provider === p.id ? 'checked' : ''} style="width:auto"> <b>${p.name}</b></label>
      <span class="badge ${S.hasKey[p.id] ? 'ok' : ''}">${S.hasKey[p.id] ? '已儲存金鑰' : '未設定'}</span></header>
    <div class="row"><button data-open="${p.url}">🔑 取得 API Key</button><button data-test>測試連線</button><button data-clear>清除金鑰</button></div>
    <input class="key" type="password" placeholder="${S.hasKey[p.id] ? '已儲存（留空表示不變更）' : p.ph}" autocomplete="off">
    <div class="g2"><div><label class="f">主模型（解題 / 對話）</label><input class="model" list="m-${p.id}" value="${esc(S.models[p.id])}"></div>
    <div><label class="f">輕量模型（遊戲觀戰，建議便宜快速的）</label><input class="light" list="m-${p.id}" value="${esc(S.lightModels[p.id])}"></div></div>
    <datalist id="m-${p.id}">${p.models.map(m => `<option value="${m}">`).join('')}</datalist>
    <details><summary>📖 ${p.name.split('（')[0]} 申請教學</summary><ol>${p.steps.map(t => `<li>${t}</li>`).join('')}</ol><p class="muted">${p.note}</p><p class="muted">模型名稱會隨官方更新，若出現「找不到模型」請直接改成官方文件上的最新名稱。</p></details>
    <div class="toast msg"></div></section>`).join('');
  $('#audd').placeholder = S.hasKey.audd ? '已儲存（留空表示不變更）' : '貼上 AudD API Token';
  $('#audd-badge').textContent = S.hasKey.audd ? '已儲存' : '未設定'; $('#audd-badge').className = 'badge' + (S.hasKey.audd ? ' ok' : '');
  $('#audioSource').value = S.audioSource; $('#persona').value = S.persona; $('#gameInterval').value = S.gameInterval;
  $('#pf').value = S.pomodoro.focus; $('#pr').value = S.pomodoro.rest; $('#language').value = S.language;
}
function collect() {
  const patch = { provider: $('input[name=provider]:checked')?.value, models: {}, lightModels: {}, keys: {}, audioSource: $('#audioSource').value, persona: $('#persona').value,
    gameInterval: +$('#gameInterval').value, pomodoro: { focus: +$('#pf').value, rest: +$('#pr').value }, language: $('#language').value.trim() || '繁體中文' };
  for (const p of PROVIDERS) {
    const c = $(`[data-p=${p.id}]`);
    patch.models[p.id] = c.querySelector('.model').value.trim() || S.models[p.id];
    patch.lightModels[p.id] = c.querySelector('.light').value.trim() || S.lightModels[p.id];
    const k = c.querySelector('.key').value.trim(); if (k) patch.keys[p.id] = k;
  }
  const a = $('#audd').value.trim(); if (a) patch.keys.audd = a;
  return patch;
}
async function save() { S = await M.saveSettings(collect()); render(); toast('已儲存 ✔'); }

document.addEventListener('click', async (e) => {
  const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); return M.openExternal(o.dataset.open); }
  const card = e.target.closest('[data-p]');
  if (e.target.id === 'save') return save();
  if (e.target.matches('[data-test]')) {
    const id = card.dataset.p, msg = card.querySelector('.msg');
    await save(); const c = $(`[data-p=${id}]`).querySelector('.msg'); c.className = 'toast msg'; c.textContent = '測試中…';
    const r = await M.testProvider(id); c.textContent = r.ok ? '✔ ' + r.message : '✘ ' + r.error; c.className = 'toast msg' + (r.ok ? '' : ' err');
  }
  if (e.target.matches('[data-clear]')) { if (confirm('確定要清除這把金鑰？')) { S = await M.saveSettings({ keys: { [card.dataset.p]: null } }); render(); } }
});
M.getSettings().then(s => { S = s; render(); });
