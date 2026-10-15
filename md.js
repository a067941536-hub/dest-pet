// 超小型、先跳脫再轉換的 Markdown（避免 XSS，不依賴套件）
(function () {
  const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" data-ext>$1</a>');
  window.renderMd = function (t) {
    const out = []; let list = null, code = null;
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const line of String(t || '').split('\n')) {
      if (/^```/.test(line)) { if (code === null) { closeList(); code = []; } else { out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); code = null; } continue; }
      if (code !== null) { code.push(line); continue; }
      let m;
      if ((m = /^(#{1,4})\s+(.*)/.exec(line))) { closeList(); out.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); }
      else if ((m = /^\s*(?:[-*•])\s+(.*)/.exec(line))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = /^\s*\d+[.)]\s+(.*)/.exec(line))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
      else if (!line.trim()) closeList();
      else { closeList(); out.push(`<p>${inline(line)}</p>`); }
    }
    closeList(); if (code) out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
    return out.join('');
  };
})();
