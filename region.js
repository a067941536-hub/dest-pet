const sel = document.getElementById('sel'); let s = null;
addEventListener('mousedown', e => { s = { x: e.clientX, y: e.clientY }; sel.style.display = 'block'; });
addEventListener('mousemove', e => {
  if (!s) return;
  Object.assign(sel.style, { left: Math.min(s.x, e.clientX) + 'px', top: Math.min(s.y, e.clientY) + 'px', width: Math.abs(e.clientX - s.x) + 'px', height: Math.abs(e.clientY - s.y) + 'px' });
});
addEventListener('mouseup', e => {
  if (!s) return;
  window.mascot.regionDone({ x: Math.min(s.x, e.clientX), y: Math.min(s.y, e.clientY), w: Math.abs(e.clientX - s.x), h: Math.abs(e.clientY - s.y) });
});
addEventListener('keydown', e => { if (e.key === 'Escape') window.mascot.regionDone(null); });
