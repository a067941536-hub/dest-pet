// 設定存放在 userData/settings.json；API Key 用 OS 金鑰庫 (safeStorage) 加密
const { app, safeStorage } = require('electron');
const fs = require('fs'), path = require('path');

const DEF = {
  provider: 'gemini',
  models: { openai: 'gpt-5.6-terra', gemini: 'gemini-flash-latest', claude: 'claude-sonnet-5-5' },
  lightModels: { openai: 'gpt-5.6-luna', gemini: 'gemini-flash-latest', claude: 'claude-haiku-5-5' },
  persona: 'auto',          // auto | roast | praise
  gameInterval: 25,         // 秒
  pomodoro: { focus: 25, rest: 5 },
  audioSource: 'system',    // system | mic
  language: '繁體中文',
};
const KEY_NAMES = ['openai', 'gemini', 'claude', 'audd'];
let cache = null;
const file = () => path.join(app.getPath('userData'), 'settings.json');

function load() {
  if (cache) return cache;
  let d = {};
  try { d = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch {}
  cache = { ...DEF, ...d,
    models: { ...DEF.models, ...d.models }, lightModels: { ...DEF.lightModels, ...d.lightModels },
    pomodoro: { ...DEF.pomodoro, ...d.pomodoro }, keys: d.keys || {} };
  return cache;
}
function save() {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(cache, null, 2));
}
const enc = (s) => safeStorage.isEncryptionAvailable()
  ? 'enc:' + safeStorage.encryptString(s).toString('base64')
  : 'raw:' + Buffer.from(s).toString('base64');
function dec(v) {
  if (!v) return '';
  try {
    if (v.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'));
    if (v.startsWith('raw:')) return Buffer.from(v.slice(4), 'base64').toString();
  } catch {}
  return '';
}
const getKey = (name) => dec(load().keys[name]);

// 給 renderer 的版本：絕不含金鑰本體
function view() {
  const s = load();
  const { keys, ...rest } = s;
  return { ...rest, hasKey: Object.fromEntries(KEY_NAMES.map(k => [k, !!keys[k]])), encrypted: safeStorage.isEncryptionAvailable() };
}
function update(patch = {}) {
  const s = load();
  for (const k of ['provider', 'persona', 'audioSource', 'language']) if (typeof patch[k] === 'string') s[k] = patch[k];
  if (patch.gameInterval) s.gameInterval = Math.min(300, Math.max(8, Number(patch.gameInterval) || 25));
  if (patch.pomodoro) s.pomodoro = { focus: Math.max(1, +patch.pomodoro.focus || 25), rest: Math.max(1, +patch.pomodoro.rest || 5) };
  if (patch.models) s.models = { ...s.models, ...patch.models };
  if (patch.lightModels) s.lightModels = { ...s.lightModels, ...patch.lightModels };
  if (patch.keys) for (const [k, v] of Object.entries(patch.keys)) {
    if (!KEY_NAMES.includes(k)) continue;
    if (v === null) delete s.keys[k]; else if (typeof v === 'string' && v.trim()) s.keys[k] = enc(v.trim());
  }
  save();
  return view();
}
const hasAnyKey = () => ['openai', 'gemini', 'claude'].some(k => load().keys[k]);
module.exports = { load, view, update, getKey, hasAnyKey };
