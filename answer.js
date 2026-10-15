const M = window.mascot, out = document.getElementById('out'), toast = document.getElementById('toast');
let current = null, image = null;
const enc = encodeURIComponent;
const say = (t, err) => { toast.textContent = t; toast.className = 'toast' + (err ? ' err' : ''); };

function block(d, img) {
  const q = d.wolfram_query || d.original || '';
  const links = [];
  if (d.tools.includes('wolframalpha') || d.wolfram_query) links.push(['WolframAlpha', `https://www.wolframalpha.com/input?i=${enc(q)}`]);
  if (d.tools.includes('geogebra')) links.push(['GeoGebra', 'https://www.geogebra.org/calculator']);
  if (d.tools.includes('desmos')) links.push(['Desmos', 'https://www.desmos.com/calculator']);
  const sq = d.search_query || d.original;
  if (sq) { links.push(['搜尋相似題目', `https://www.google.com/search?q=${enc(sq)}`]); links.push(['找類似圖片', `https://www.google.com/search?tbm=isch&q=${enc(sq)}`]); }
  const el = document.createElement('section'); el.className = 'card';
  el.innerHTML = `${img ? `<img class="shot" src="${img}" alt="題目截圖">` : ''}
    ${d.final_answer ? '<div class="final"></div>' : ''}
    <div class="md">${renderMd(d.answer_markdown)}</div>
    <div class="row">
      ${d.original ? '<button data-a="orig">還原原題 / 算式</button>' : ''}
      <button data-a="copy">複製解答</button>
      ${d.notepad_text ? '<button data-a="note">📝 在記事本寫入</button>' : ''}
      ${d.drawing ? '<button data-a="paint">🎨 小畫家圖解</button>' : ''}
    </div>
    <pre class="orig" hidden></pre>
    ${d.drawing?.caption ? '<p class="muted"></p>' : ''}
    ${links.length ? '<div class="row">' + links.map(([n, u]) => `<button data-open="${u}">🔗 ${n}</button>`).join('') + '</div>' : ''}
    ${img ? '<div class="row"><span class="muted">以圖搜圖：</span><button data-s="lens">Google Lens</button><button data-s="tineye">TinEye</button><button data-s="yandex">Yandex</button><button data-s="bing">Bing</button></div>' : ''}`;
  if (d.final_answer) el.querySelector('.final').textContent = '答案：' + d.final_answer;   // textContent 避免注入
  el.querySelector('.orig').textContent = d.original;
  const cap = el.querySelector('p.muted'); if (cap) cap.textContent = '圖解說明：' + d.drawing.caption;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.open) return M.openExternal(b.dataset.open);
    if (b.dataset.s) { const r = await M.reverseSearch(b.dataset.s); return say(r.message, !r.ok); }
    if (b.dataset.a === 'orig') el.querySelector('.orig').hidden = !el.querySelector('.orig').hidden;
    if (b.dataset.a === 'copy') { await navigator.clipboard.writeText((d.final_answer ? '答案：' + d.final_answer + '\n\n' : '') + d.answer_markdown); say('已複製'); }
    if (b.dataset.a === 'note') { if (!confirm('小糰會開啟記事本並逐字輸入內容。\n過程中按 Esc 可隨時中止。要開始嗎？')) return; say('輸入中…（Esc 可中止）'); const r = await M.notepad(d.notepad_text); say(r.message, !r.ok); }
    if (b.dataset.a === 'paint') { if (!confirm('小糰會開啟小畫家並用滑鼠自動畫圖。\n過程中請不要動滑鼠，按 Esc 可隨時中止。要開始嗎？')) return; say('繪製中…（Esc 可中止）'); const r = await M.paint(d.drawing); say(r.message, !r.ok); }
  });
  return el;
}
document.addEventListener('click', e => { const a = e.target.closest('a[data-ext]'); if (a) { e.preventDefault(); M.openExternal(a.href); } });

M.onAnswer(({ data, image: img }) => { out.innerHTML = '<h1>🐾 小糰的解答</h1>'; image = img; current = data; out.appendChild(block(data, img)); window.scrollTo(0, 0); });
async function followUp() {
  const t = document.getElementById('ask').value.trim(); if (!t) return;
  document.getElementById('ask').value = ''; say('思考中…');
  const r = await M.ask({ text: t, images: [], newSession: false });
  if (!r.ok) return say(r.error, true);
  say(''); const hr = document.createElement('p'); hr.className = 'muted'; hr.textContent = '追問：' + t;
  out.appendChild(hr); out.appendChild(block(r.data, null)); hr.scrollIntoView({ behavior: 'smooth' });
}
document.getElementById('send').onclick = followUp;
document.getElementById('ask').addEventListener('keydown', e => { if (e.key === 'Enter') followUp(); });
