// Lightweight, serverless export of a DOM node to PNG/PDF using CDN-loaded libs.
const H2C_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

function loadScript(src){
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

export async function ensureHtml2Canvas(){
  if (!window.html2canvas) await loadScript(H2C_URL);
}

export async function ensureJsPDF(){
  if (!window.jspdf) await loadScript(JSPDF_URL);
}

export async function exportGridPNG(node, filename='plancraft-grid.png'){
  // ensure export-mode on original document for variable fallbacks
  document.documentElement.classList.add('export-mode');
  if (!node) throw new Error('exportGridPNG: node is null');
  await ensureHtml2Canvas();
  let canvas;
  try{
    canvas = await window.html2canvas(node, {
      backgroundColor: '#fff',
      useCORS: true,
      scale: 2,
      onclone: (doc) => doc.documentElement.classList.add('export-mode'),
    });
  }catch(err){
    // Retry with foreignObjectRendering for broader CSS support
    console.warn('html2canvas retry with foreignObjectRendering due to:', err);
    canvas = await window.html2canvas(node, {
      backgroundColor: '#fff',
      useCORS: true,
      scale: 2,
      foreignObjectRendering: true,
      onclone: (doc) => doc.documentElement.classList.add('export-mode'),
    });
  }
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportGridPDF(node, filename='plancraft-grid.pdf'){
  document.documentElement.classList.add('export-mode');
  if (!node) throw new Error('exportGridPDF: node is null');
  await ensureHtml2Canvas();
  await ensureJsPDF();
  let canvas;
  try{
    canvas = await window.html2canvas(node, {
      backgroundColor: '#fff',
      useCORS: true,
      scale: 2,
      onclone: (doc) => doc.documentElement.classList.add('export-mode'),
    });
  }catch(err){
    // Retry with foreignObjectRendering for broader CSS support
    console.warn('html2canvas retry with foreignObjectRendering due to:', err);
    canvas = await window.html2canvas(node, {
      backgroundColor: '#fff',
      useCORS: true,
      scale: 2,
      foreignObjectRendering: true,
      onclone: (doc) => doc.documentElement.classList.add('export-mode'),
    });
  }
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  // fit preserving aspect ratio
  const w = canvas.width / 2; // due to scale:2
  const h = canvas.height / 2;
  const ratio = Math.min(pageW / w, pageH / h);
  const drawW = w * ratio;
  const drawH = h * ratio;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;
  pdf.addImage(imgData, 'PNG', x, y, drawW, drawH);
  pdf.save(filename);
}
