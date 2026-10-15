// 三家模型統一介面：OpenAI / Gemini / Claude。金鑰只存在主進程。
const settings = require('./settings');
const P = require('../prompts');
const { toDataUrl, fingerprint, diff } = require('./img');

const LABEL = { openai: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' };

async function post(url, headers, body, label) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 90000);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
  } catch (e) {
    throw new Error(`${label}：連線失敗（${e.name === 'AbortError' ? '逾時' : e.message}）`);
  } finally { clearTimeout(timer); }
  const txt = await res.text();
  let j; try { j = JSON.parse(txt); } catch {}
  if (!res.ok) {
    const m = j?.error?.message || j?.error || txt.slice(0, 200);
    const hint = { 400: '請求格式或模型名稱有誤', 401: 'API Key 無效或已撤銷', 403: '沒有權限，或帳號/地區不允許', 404: '找不到此模型，請到設定確認模型名稱', 429: '額度用完或請求太頻繁（請檢查帳單與配額）' }[res.status] || '';
    throw new Error(`${label} ${res.status}：${hint} ${typeof m === 'string' ? m : JSON.stringify(m)}`.trim());
  }
  return j;
}
const parseUrl = (u) => { const m = /^data:([^;]+);base64,(.+)$/.exec(u); return { mime: m[1], b64: m[2] }; };

const adapters = {
  async openai({ model, key, system, messages, json }) {
    const body = { model, messages: [{ role: 'system', content: system }, ...messages.map(m => ({
      role: m.role,
      content: m.images?.length ? [{ type: 'text', text: m.text }, ...m.images.map(u => ({ type: 'image_url', image_url: { url: u } }))] : m.text,
    }))] };
    if (json) body.response_format = { type: 'json_object' };
    const j = await post('https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${key}` }, body, 'ChatGPT');
    return j.choices?.[0]?.message?.content || '';
  },
  async gemini({ model, key, system, messages, json }) {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }, ...(m.images || []).map(u => { const { mime, b64 } = parseUrl(u); return { inline_data: { mime_type: mime, data: b64 } }; })] })),
    };
    if (json) body.generationConfig = { responseMimeType: 'application/json' };
    const j = await post(`https://generativelanguage.googleapis.com/v1beta/models/${model.replace(/^models\//, '')}:generateContent`, { 'x-goog-api-key': key }, body, 'Gemini');
    const t = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!t) throw new Error('Gemini 沒有回傳內容（可能被安全過濾，換個畫面或模型試試）');
    return t;
  },
  async claude({ model, key, system, messages }) {
    const body = { model, max_tokens: 4096, system, messages: messages.map(m => ({
      role: m.role,
      content: [...(m.images || []).map(u => { const { mime, b64 } = parseUrl(u); return { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } }; }), { type: 'text', text: m.text }],
    })) };
    const j = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body, 'Claude');
    return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  },
};

async function chat({ provider, light = false, system, messages, json = true }) {
  const s = settings.load();
  provider = provider || s.provider;
  const key = settings.getKey(provider);
  if (!key) throw new Error(`尚未設定 ${LABEL[provider]} 的 API Key，請到 ⚙️ 設定貼上金鑰`);
  const model = (light ? s.lightModels : s.models)[provider];
  return adapters[provider]({ model, key, system, messages, json });
}

function extractJson(t) {
  t = String(t || '').replace(/```json|```/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}
const str = (v) => (typeof v === 'string' ? v : '');
function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  let drawing = null;
  if (d.drawing && Array.isArray(d.drawing.paths)) {
    const paths = d.drawing.paths.slice(0, 12).map(p => ({
      points: (p.points || []).slice(0, 400)
        .filter(q => Array.isArray(q) && q.length === 2 && q.every(n => typeof n === 'number' && isFinite(n)))
        .map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))]),
    })).filter(p => p.points.length >= 2);
    if (paths.length) drawing = { caption: str(d.drawing.caption), paths };
  }
  return {
    mood: ['idle', 'focus', 'happy'].includes(d.mood) ? d.mood : 'happy',
    original: str(d.original), final_answer: str(d.final_answer), answer_markdown: str(d.answer_markdown),
    wolfram_query: str(d.wolfram_query), search_query: str(d.search_query), notepad_text: str(d.notepad_text),
    tools: Array.isArray(d.tools) ? d.tools.filter(t => ['wolframalpha', 'geogebra', 'desmos'].includes(t)) : [],
    drawing,
  };
}

// ---- 解題 / 對話（保留短期上下文，支援追問）----
let history = [];
async function ask({ text, images = [], newSession }) {
  if (newSession) history = [];
  history.push({ role: 'user', text: text || '請解這題', images });
  history = history.slice(-8).map((m, i, arr) => (i < arr.length - 1 ? { ...m, images: [] } : m)); // 舊圖不重送
  try {
    const raw = await chat({ system: P.solver(settings.load().language), messages: history });
    history.push({ role: 'assistant', text: raw });
    const parsed = extractJson(raw);
    return { ok: true, data: normalize(parsed || { answer_markdown: raw }) };
  } catch (e) { history.pop(); return { ok: false, error: e.message }; }
}

// ---- 遊戲觀戰 ----
let lastFp = null; const recent = [];
async function gameTick(img) {
  try {
    const fp = fingerprint(img);
    if (lastFp && diff(lastFp, fp) < 2.5) return { ok: true, skipped: true };
    lastFp = fp;
    const s = settings.load();
    const raw = await chat({ light: true, system: P.game(s.persona, s.language), messages: [{ role: 'user', text: P.gameUser(recent), images: [toDataUrl(img, 1280)] }] });
    const d = extractJson(raw);
    if (!d || d.event === 'none' || !d.comment || (d.confidence ?? 1) < 0.5) return { ok: true, silent: true };
    recent.push(d.comment); if (recent.length > 6) recent.shift();
    return { ok: true, comment: d.comment, mood: d.mode === 'roast' ? 'taunt' : 'happy', event: d.event };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function test(provider) {
  try {
    const t = await chat({ provider, light: true, system: '你是連線測試，只回覆 OK。', messages: [{ role: 'user', text: '回覆 OK' }], json: false });
    return { ok: true, message: `連線成功：${String(t).slice(0, 40)}` };
  } catch (e) { return { ok: false, error: e.message }; }
}
module.exports = { ask, gameTick, test };
