// 圖片縮放/轉 dataURL，控制上傳大小與 token 成本
function toDataUrl(img, maxW = 1600) {
  const { width } = img.getSize();
  const out = width > maxW ? img.resize({ width: maxW, quality: 'good' }) : img;
  return 'data:image/jpeg;base64,' + out.toJPEG(82).toString('base64');
}
// 16x9 縮圖指紋：畫面幾乎沒變就不呼叫 AI，省錢
function fingerprint(img) { return img.resize({ width: 16, height: 9 }).toBitmap(); }
function diff(a, b) {
  if (!a || !b || a.length !== b.length) return 255;
  let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}
module.exports = { toDataUrl, fingerprint, diff };
