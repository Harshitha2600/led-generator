const TEXT_COLORS = ['#ffffff', '#ffff00', '#00c3ff', '#ff6b00', '#00e676', '#ff4081', '#e040fb', '#39ff88'];
const FONTS = [
  { n: 'DM Sans', v: "'DM Sans',sans-serif" },
  { n: 'Oswald', v: "'Oswald',sans-serif" },
  { n: 'Syne', v: "'Syne',sans-serif" },
  { n: 'Impact', v: 'Impact,sans-serif' },
  { n: 'Georgia', v: 'Georgia,serif' },
  { n: 'Courier New', v: "'Courier New',monospace" },
  { n: 'Arial Black', v: "'Arial Black',sans-serif" },
];
const LED_CONFIG = {
  indoor: {
    P4: { pitch: 4, mm: 4, pixels: { w: 80, h: 40 }, label: 'Indoor professional' },
    P3: { pitch: 3, mm: 3, pixels: { w: 64, h: 64 }, label: 'Professional grade' },
    'P2.5': { pitch: 2.5, mm: 2.5, pixels: { w: 128, h: 64 }, label: 'High-res indoor' },
    P2: { pitch: 2, mm: 2, pixels: { w: 160, h: 80 }, label: 'Ultra high-res' },
  },
  outdoor: {
    P10: { pitch: 10, mm: 10, pixels: { w: 32, h: 16 }, label: 'Outdoor advertising' },
    P5: { pitch: 5, mm: 5, pixels: { w: 64, h: 32 }, label: 'Outdoor medium-res' },
    P4: { pitch: 4, mm: 4, pixels: { w: 80, h: 40 }, label: 'Outdoor professional' },
    P3: { pitch: 3, mm: 3, pixels: { w: 64, h: 64 }, label: 'High-res outdoor' },
  },
};
const DEFAULT_LINE = () => ({
  id: Date.now() + Math.random(),
  text: '',
  fontSize: 80,
  fontFamily: FONTS[0].v,
  color: '#ffffff',
  bold: true,
  italic: false,
  underline: false,
  align: 'center',
  letterSpacing: 1,
});
const DEFAULT_STATE = {
  lines: [DEFAULT_LINE()],
  boardId: 'default',
  selectedPitch: { code: 'P10', category: 'outdoor', pixels: { w: 32, h: 16 }, mm: 10 },
  background: '#000000',
  widthFt: 6,
  heightFt: 1,
};

const state = structuredClone(DEFAULT_STATE);
const elements = {};

const cacheElements = () => {
  elements.dbPill = document.getElementById('db-pill');
  elements.dbLabel = document.getElementById('db-label');
  elements.pages = document.querySelectorAll('.page');
  elements.linesList = document.getElementById('lines-list');
  elements.styleBlocks = document.getElementById('style-blocks');
  elements.indoorGrid = document.getElementById('indoor-pitch-grid');
  elements.outdoorGrid = document.getElementById('outdoor-pitch-grid');
  elements.sizePresets = document.getElementById('size-presets');
  elements.sw = document.getElementById('sw');
  elements.sh = document.getElementById('sh');
  elements.pixelNote = document.getElementById('pixel-count-note');
  elements.stage = document.getElementById('stage');
  elements.boardWrap = document.getElementById('board-wrap');
  elements.boardCanvas = document.getElementById('board-canvas');
  elements.sizeTag = document.getElementById('size-tag');
  elements.pitchTag = document.getElementById('pitch-tag');
  elements.pixelInfo = document.getElementById('pixel-info');
  elements.savedList = document.getElementById('saved-list');
  elements.urlShow = document.getElementById('url-show');
  elements.openLink = document.getElementById('open-link');
  elements.overlay = document.getElementById('overlay');
  elements.layoutLiveCanvas = document.getElementById('layout-live-canvas');
  elements.layoutPreviewInfo = document.getElementById('layout-preview-info');
  elements.ovText = document.getElementById('ov-text');
  elements.resultBar = document.getElementById('result-bar');
  elements.copyBtn = document.getElementById('copy-btn');
  elements.permanentDisplayUrl = document.getElementById('permanent-display-url');
};

const getDisplayUrl = () => {
  const id = String(state.boardId || 'default').trim();
  return id === 'default' ? `${location.origin}/display` : `${location.origin}/display/${encodeURIComponent(id)}`;
};

const getUpdateEndpoint = () => {
  const id = String(state.boardId || 'default').trim();
  return id === 'default' ? '/update' : `/update/${encodeURIComponent(id)}`;
};

const setPill = (ok) => {
  if (!elements.dbPill || !elements.dbLabel) return;
  elements.dbPill.className = `db-pill ${ok ? 'ok' : 'err'}`;
  elements.dbLabel.textContent = ok ? 'Live API OK' : 'API offline';
};

const updatePermanentUrlUI = () => {
  const url = getDisplayUrl();
  if (elements.permanentDisplayUrl) elements.permanentDisplayUrl.textContent = url;
  if (elements.urlShow) elements.urlShow.textContent = url;
  if (elements.openLink) elements.openLink.href = url;
};

const checkLiveAPI = async () => {
  try {
    const response = await fetch('/health/live');
    if (!response.ok) throw new Error('Health check failed');
    setPill(true);
  } catch (_err) {
    setPill(false);
  }
};

const showPage = (pageNumber) => {
  elements.pages.forEach((page) => page.classList.remove('active'));
  const target = document.getElementById(`p${pageNumber}`);
  if (target) target.classList.add('active');
  if (pageNumber === 1) loadRecent();
  if (pageNumber === 5) setTimeout(() => renderLayoutLivePreview(), 80);
  if (pageNumber === 6) requestAnimationFrame(() => setTimeout(() => renderPreview(), 40));
};

const addLine = () => {
  state.lines.push(DEFAULT_LINE());
  renderLines();
  renderStyleBlocks();
};

const removeLine = (lineId) => {
  if (state.lines.length <= 1) return;
  state.lines = state.lines.filter((line) => line.id !== lineId);
  renderLines();
  renderStyleBlocks();
  livePreview();
};

const updateLineProperty = (lineId, key, value) => {
  const line = state.lines.find((entry) => entry.id === lineId);
  if (!line) return;
  line[key] = value;
  if (key === 'text') renderStyleBlocks();
  livePreview();
};

const toggleLineStyle = (lineId, styleKey) => {
  const line = state.lines.find((entry) => entry.id === lineId);
  if (!line) return;
  line[styleKey] = !line[styleKey];
  renderStyleBlocks();
  livePreview();
};

const startNew = () => {
  state.lines = [DEFAULT_LINE()];
  state.widthFt = DEFAULT_STATE.widthFt;
  state.heightFt = DEFAULT_STATE.heightFt;
  state.selectedPitch = { ...DEFAULT_STATE.selectedPitch };
  state.boardId = new URLSearchParams(location.search).get('id') || 'default';
  syncSizeInputs();
  updatePermanentUrlUI();
  showPage(2);
  renderLines();
  renderStyleBlocks();
  buildPitchGrid();
  livePreview();
};

const goToStyle = () => {
  if (!state.lines.some((line) => line.text.trim())) {
    window.alert('Please enter text in at least one line first.');
    return;
  }
  renderStyleBlocks();
  showPage(3);
};

const renderLines = () => {
  if (!elements.linesList) return;
  elements.linesList.innerHTML = '';
  state.lines.forEach((line, index) => {
    const card = document.createElement('div');
    card.className = 'line-card';
    card.innerHTML = `
      <div class="line-num">${index + 1}</div>
      <textarea class="line-input" data-line-id="${line.id}" rows="2" placeholder="Line ${index + 1} text...">${line.text}</textarea>
      ${state.lines.length > 1 ? `<button type="button" class="line-del" data-action="remove-line" data-line-id="${line.id}" title="Remove">x</button>` : ''}
    `;
    elements.linesList.appendChild(card);
  });
};

const renderStyleBlocks = () => {
  if (!elements.styleBlocks) return;
  elements.styleBlocks.innerHTML = '';
  state.lines
    .filter((line) => line.text.trim())
    .forEach((line, index) => {
      const block = document.createElement('div');
      block.className = 'sblock';
      block.innerHTML = `
        <div class="sblock-head">
          <div class="sblock-num">${index + 1}</div>
          <div class="sblock-text">"${line.text.substring(0, 40)}${line.text.length > 40 ? '...' : ''}"</div>
        </div>
        <div class="sblock-body">
          <div class="ctrl-row">
            <div class="ctrl">
              <div class="ctrl-label">Font Size</div>
              <input type="number" class="cinput style-input" data-line-id="${line.id}" data-field="fontSize" value="${line.fontSize}" min="12" max="200" step="2">
            </div>
            <div class="ctrl">
              <div class="ctrl-label">Letter Spacing (px)</div>
              <input type="number" class="cinput style-input" data-line-id="${line.id}" data-field="letterSpacing" value="${line.letterSpacing}" min="-5" max="40" step="1">
            </div>
          </div>
          <div class="ctrl">
            <div class="ctrl-label">Font Family</div>
            <select class="cselect style-input" data-line-id="${line.id}" data-field="fontFamily">
              ${FONTS.map((font) => `<option value="${font.v}" ${line.fontFamily === font.v ? 'selected' : ''}>${font.n}</option>`).join('')}
            </select>
          </div>
          <div class="ctrl">
            <div class="ctrl-label">Text Color</div>
            <div class="color-row">
              <input type="color" class="cswatch style-input" data-line-id="${line.id}" data-field="color" value="${line.color}">
              <div class="cprow">
                ${TEXT_COLORS.map((color) => `<button type="button" class="cp" data-action="set-color" data-line-id="${line.id}" data-color="${color}" style="background:${color};border:2px solid #444"></button>`).join('')}
              </div>
            </div>
          </div>
          <div class="ctrl">
            <div class="ctrl-label">Style</div>
            <div class="togs">
              <button type="button" class="tog ${line.bold ? 'on' : ''}" data-action="toggle-style" data-line-id="${line.id}" data-field="bold">B</button>
              <button type="button" class="tog ${line.italic ? 'on' : ''}" data-action="toggle-style" data-line-id="${line.id}" data-field="italic">I</button>
              <button type="button" class="tog ${line.underline ? 'on' : ''}" data-action="toggle-style" data-line-id="${line.id}" data-field="underline">U</button>
            </div>
          </div>
          <div class="ctrl">
            <div class="ctrl-label">Alignment</div>
            <div class="aligns">
              <button type="button" class="aln ${line.align === 'left' ? 'on' : ''}" data-action="set-align" data-line-id="${line.id}" data-align="left">Left</button>
              <button type="button" class="aln ${line.align === 'center' ? 'on' : ''}" data-action="set-align" data-line-id="${line.id}" data-align="center">Center</button>
              <button type="button" class="aln ${line.align === 'right' ? 'on' : ''}" data-action="set-align" data-line-id="${line.id}" data-align="right">Right</button>
            </div>
          </div>
        </div>
      `;
      elements.styleBlocks.appendChild(block);
    });
};

const syncSizeInputs = () => {
  if (elements.sw) elements.sw.value = state.widthFt;
  if (elements.sh) elements.sh.value = state.heightFt;
};

const buildPitchGrid = () => {
  if (elements.indoorGrid) {
    elements.indoorGrid.innerHTML = Object.entries(LED_CONFIG.indoor)
      .map(([code, config]) => `
        <button type="button" class="pitch-btn${state.selectedPitch.code === code && state.selectedPitch.category === 'indoor' ? ' sel' : ''}" data-action="select-pitch" data-pitch="${code}" data-category="indoor">
          <span class="pitch-code">${code}</span>
          <span class="pitch-mm">${config.mm}mm</span>
          <span class="pitch-use">Indoor</span>
          <span class="pitch-res">${config.pixels.w} x ${config.pixels.h} px</span>
        </button>
      `).join('');
  }
  if (elements.outdoorGrid) {
    elements.outdoorGrid.innerHTML = Object.entries(LED_CONFIG.outdoor)
      .map(([code, config]) => `
        <button type="button" class="pitch-btn${state.selectedPitch.code === code && state.selectedPitch.category === 'outdoor' ? ' sel' : ''}" data-action="select-pitch" data-pitch="${code}" data-category="outdoor">
          <span class="pitch-code">${code}</span>
          <span class="pitch-mm">${config.mm}mm</span>
          <span class="pitch-use">Outdoor</span>
          <span class="pitch-res">${config.pixels.w} x ${config.pixels.h} px</span>
        </button>
      `).join('');
  }
  updatePixelNote();
};

const buildSizePresets = () => {
  if (!elements.sizePresets) return;
  const presets = [
    { label: '4x0.5 ft\nName board', data: { w: 4, h: 0.5 } },
    { label: '6x1 ft\nBanner', data: { w: 6, h: 1 } },
    { label: '10x2 ft\nStorefront', data: { w: 10, h: 2 } },
    { label: '8x4 ft\nBillboard', data: { w: 8, h: 4 } },
    { label: '16x9 ft\nStage screen', data: { w: 16, h: 9 } },
    { label: '20x10 ft\nOutdoor large', data: { w: 20, h: 10 } },
  ];
  elements.sizePresets.innerHTML = presets
    .map((preset) => `<button type="button" class="pset" data-action="set-size" data-width="${preset.data.w}" data-height="${preset.data.h}">${preset.label}</button>`)
    .join('');
};

const selectPitch = (code, category) => {
  const config = category === 'indoor' ? LED_CONFIG.indoor[code] : LED_CONFIG.outdoor[code];
  if (!config) return;
  state.selectedPitch = { code, category, pixels: config.pixels, mm: config.mm };
  buildPitchGrid();
  livePreview();
};

const getBoardSpec = () => {
  const widthFt = Math.max(1, Number(elements.sw?.value || state.widthFt) || 6);
  const heightFt = Math.max(0.5, Number(elements.sh?.value || state.heightFt) || 1);
  state.widthFt = widthFt;
  state.heightFt = heightFt;
  const pitchMM = Number(state.selectedPitch?.mm || 10);
  const ledCols = Math.max(16, Math.round((widthFt * 304.8) / pitchMM));
  const ledRows = Math.max(8, Math.round((heightFt * 304.8) / pitchMM));
  return { widthFt, heightFt, pitchMM, ledCols, ledRows };
};

const updatePixelNote = () => {
  if (!elements.pixelNote) return;
  const { widthFt, heightFt, ledCols, ledRows } = getBoardSpec();
  elements.pixelNote.textContent = `${state.selectedPitch.code} | ${widthFt}x${heightFt} ft | ${ledCols}x${ledRows} LEDs | ${(ledCols * ledRows).toLocaleString()} dots`;
};

// ─── MEASURE HELPERS ──────────────────────────────────────────────────────────
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');

const measureTextWidth = (line, fontSize) => {
  const fontStr = `${line.bold ? 'bold ' : ''}${line.italic ? 'italic ' : ''}${fontSize}px ${line.fontFamily}`.trim();
  measureCtx.font = fontStr;
  const base = measureCtx.measureText(line.text).width;
  if (!line.text || line.text.length <= 1 || !line.letterSpacing) return base;
  return base + (line.text.length - 1) * Number(line.letterSpacing);
};

// Binary search — finds largest font size where text fits maxWidth
const fitFontSize = (line, maxWidth, maxHeight) => {
  let lo = 1, hi = maxHeight * 2;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (measureTextWidth(line, mid) < maxWidth * 0.98) lo = mid;
    else hi = mid;
  }
  return Math.max(4, Math.min(lo, maxHeight * 0.95));
};

// ─── PLAIN TEXT PREVIEW RENDERER (no LED dots, black bg) ─────────────────────
const renderPlainPreview = (container) => {
  if (!container) return;

  const activeLines = state.lines.filter((l) => l.text.trim());
  if (!activeLines.length) {
    container.innerHTML = '';
    return;
  }

  const cw = container.clientWidth  || container.offsetWidth  || 400;
  const ch = container.clientHeight || container.offsetHeight || 200;
  const rowHeight = ch / activeLines.length;

  // Build or reuse line divs
  let existing = container.querySelectorAll('.prev-line');
  if (existing.length !== activeLines.length) {
    container.innerHTML = '';
    activeLines.forEach(() => {
      const d = document.createElement('div');
      d.className = 'prev-line';
      d.style.cssText = 'display:block;white-space:nowrap;width:100%;padding:0;margin:0;background:transparent;overflow:hidden;';
      container.appendChild(d);
    });
    existing = container.querySelectorAll('.prev-line');
  }

  existing.forEach((el, i) => {
    const line = activeLines[i];
    const fontSize = fitFontSize(line, cw, rowHeight);
    el.textContent       = line.text;
    el.style.color       = line.color;
    el.style.textAlign   = line.align;
    el.style.fontFamily  = line.fontFamily;
    el.style.fontWeight  = line.bold   ? '800' : '400';
    el.style.fontStyle   = line.italic ? 'italic' : 'normal';
    el.style.fontSize    = fontSize + 'px';
    el.style.height      = rowHeight + 'px';
    el.style.lineHeight  = rowHeight + 'px';
    el.style.letterSpacing = (Number(line.letterSpacing) || 0) + 'px';
  });
};

// ─── LAYOUT PAGE (p5) LIVE PREVIEW ───────────────────────────────────────────
const renderLayoutLivePreview = () => {
  const wrap = document.getElementById('layout-preview-wrap');
  if (wrap) {
    renderPlainPreview(wrap);
    return;
  }
  // Fallback: use canvas element but draw plain text on black
  if (!elements.layoutLiveCanvas) return;
  const canvas = elements.layoutLiveCanvas;
  const { widthFt, heightFt } = getBoardSpec();
  const displayWidth = canvas.clientWidth || 420;
  canvas.width  = displayWidth;
  canvas.height = Math.max(1, Math.round(displayWidth * (heightFt / widthFt)));

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const activeLines = state.lines.filter((l) => l.text.trim());
  if (!activeLines.length) return;

  const rowHeight = canvas.height / activeLines.length;
  activeLines.forEach((line, i) => {
    const fontSize = fitFontSize(line, canvas.width, rowHeight);
    const fontStr = `${line.bold ? 'bold ' : ''}${line.italic ? 'italic ' : ''}${fontSize}px ${line.fontFamily}`.trim();
    ctx.font = fontStr;
    ctx.fillStyle = line.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = line.align;
    const y = (i + 0.5) * rowHeight;
    const x = line.align === 'left' ? 2 : line.align === 'right' ? canvas.width - 2 : canvas.width / 2;
    ctx.fillText(line.text, x, y);
  });

  if (elements.layoutPreviewInfo) {
    const { ledCols, ledRows } = getBoardSpec();
    elements.layoutPreviewInfo.textContent = `${state.selectedPitch.code} | ${widthFt}x${heightFt} ft | ${ledCols}x${ledRows} LEDs`;
  }
};

// ─── FULL PREVIEW PAGE (p6) ───────────────────────────────────────────────────
const renderPreview = () => {
  if (!elements.boardCanvas || !elements.boardWrap || !elements.stage) return;
  const { widthFt, heightFt, ledCols, ledRows } = getBoardSpec();

  if (elements.sizeTag)   elements.sizeTag.textContent  = `${widthFt} x ${heightFt} ft`;
  if (elements.pitchTag)  elements.pitchTag.textContent = state.selectedPitch.code;
  if (elements.pixelInfo) elements.pixelInfo.textContent = `${ledCols} x ${ledRows} LED px`;

  const aspect = widthFt / heightFt;
  const stageW = elements.stage.clientWidth  || window.innerWidth;
  const stageH = elements.stage.clientHeight || (window.innerHeight - 160);
  let canvasW, canvasH;
  if (stageW / stageH > aspect) { canvasH = stageH; canvasW = canvasH * aspect; }
  else { canvasW = stageW; canvasH = canvasW / aspect; }

  elements.boardWrap.style.width  = `${canvasW}px`;
  elements.boardWrap.style.height = `${canvasH}px`;
  elements.boardCanvas.width  = Math.max(1, Math.round(canvasW));
  elements.boardCanvas.height = Math.max(1, Math.round(canvasH));
  elements.boardCanvas.style.width  = `${canvasW}px`;
  elements.boardCanvas.style.height = `${canvasH}px`;

  // Draw plain text on black — NO LED dots
  const canvas = elements.boardCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const activeLines = state.lines.filter((l) => l.text.trim());
  if (!activeLines.length) return;

  const rowHeight = canvas.height / activeLines.length;
  activeLines.forEach((line, i) => {
    const fontSize = fitFontSize(line, canvas.width, rowHeight);
    const fontStr = `${line.bold ? 'bold ' : ''}${line.italic ? 'italic ' : ''}${fontSize}px ${line.fontFamily}`.trim();
    ctx.font = fontStr;
    ctx.fillStyle = line.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = line.align;
    const y = (i + 0.5) * rowHeight;
    const x = line.align === 'left' ? 2 : line.align === 'right' ? canvas.width - 2 : canvas.width / 2;
    ctx.fillText(line.text, x, y);
  });
};

const livePreview = () => {
  updatePixelNote();
  if (document.getElementById('p5')?.classList.contains('active')) renderLayoutLivePreview();
  if (document.getElementById('p6')?.classList.contains('active')) renderPreview();
};

const copyURL = () => {
  const url = elements.urlShow?.textContent;
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    if (!elements.copyBtn) return;
    elements.copyBtn.textContent = 'Copied!';
    elements.copyBtn.classList.add('ok');
    setTimeout(() => { elements.copyBtn.textContent = 'Copy'; elements.copyBtn.classList.remove('ok'); }, 1800);
  });
};

const saveAndGen = async () => {
  const activeLines = state.lines.filter((line) => line.text.trim());
  if (!activeLines.length) { window.alert('Add at least one line of text.'); return; }
  if (!elements.overlay || !elements.ovText) return;

  elements.ovText.textContent = 'Updating permanent text URL...';
  elements.overlay.classList.add('show');

  try {
    const payload = { lines: activeLines.map(({ id, ...line }) => line) };
    const response = await fetch(getUpdateEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Update failed');
    state.boardId = data.id || state.boardId;
    updatePermanentUrlUI();
    if (elements.resultBar) elements.resultBar.classList.add('show');
    elements.ovText.textContent = 'Text URL updated live';
    setTimeout(() => elements.overlay.classList.remove('show'), 900);
    setPill(true);
  } catch (error) {
    elements.overlay.classList.remove('show');
    window.alert(`Update failed: ${error.message}`);
    setPill(false);
  }
};

const escapeHTML = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const buildContentHTML = () => {
  const activeLines = state.lines.filter((line) => line.text.trim());
  const { ledCols } = getBoardSpec();
  return activeLines
    .map((line) => {
      const vw = (Math.max(12, line.fontSize) / ledCols) * 100;
      return `<div style="font-family:${line.fontFamily};font-size:clamp(10px,${vw}vw,${line.fontSize * 3}px);color:${line.color};font-weight:${line.bold ? 700 : 400};font-style:${line.italic ? 'italic' : 'normal'};text-decoration:${line.underline ? 'underline' : 'none'};text-align:${line.align};letter-spacing:${line.letterSpacing}px;line-height:1.05;width:100%;display:block">${escapeHTML(line.text)}</div>`;
    }).join('');
};

const dlHTML = () => {
  const { widthFt, heightFt } = getBoardSpec();
  const aspect = widthFt / heightFt;
  const contentHTML = buildContentHTML();
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Board ${widthFt}x${heightFt}ft ${state.selectedPitch.code}</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Syne:wght@700;800&family=Oswald:wght@400;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:black;overflow:hidden}.b{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);aspect-ratio:${aspect};width:min(100vw,calc(100vh * ${aspect}));background:black;display:flex;flex-direction:column;align-items:stretch;justify-content:center;padding:0;gap:0}</style></head><body><div class="b">${contentHTML}</div></body></html>`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  link.download = `board_${widthFt}x${heightFt}ft_${state.selectedPitch.code}.html`;
  link.click();
};

const loadRecent = async () => {
  if (!elements.savedList) return;
  try {
    const response = await fetch('/api/boards');
    if (!response.ok) throw new Error('Recent boards unavailable');
    const data = await response.json();
    if (!data.boards?.length) {
      elements.savedList.innerHTML = '<div class="empty">Permanent display mode is ready. Saved board history is empty.</div>';
      return;
    }
    elements.savedList.innerHTML = data.boards.slice(0, 5)
      .map((board) => `
        <a class="saved-row" href="/board/${board.slug}" target="_blank" rel="noreferrer">
          <div>
            <div class="saved-slug">${board.slug}</div>
            <div class="saved-info">${board.widthFt}x${board.heightFt} ft | ${board.pitchCode || 'P10'} | ${((board.lines && board.lines.length) || 0)} lines | Views ${board.views}</div>
          </div>
          <div class="saved-date">${new Date(board.createdAt).toLocaleDateString()}</div>
        </a>
      `).join('');
  } catch (_err) {
    elements.savedList.innerHTML = '<div class="empty">Permanent display mode is active. Recent boards unavailable.</div>';
  }
};

const handleBodyClick = (event) => {
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  switch (action) {
    case 'start-new':      startNew(); break;
    case 'go':             showPage(Number(actionTarget.dataset.page)); break;
    case 'add-line':       addLine(); break;
    case 'go-to-style':    goToStyle(); break;
    case 'go-to-preview':  showPage(6); break;
    case 'select-pitch':   selectPitch(actionTarget.dataset.pitch, actionTarget.dataset.category); break;
    case 'set-size':
      state.widthFt  = Number(actionTarget.dataset.width);
      state.heightFt = Number(actionTarget.dataset.height);
      syncSizeInputs();
      livePreview();
      break;
    case 'download-html':  dlHTML(); break;
    case 'save-and-gen':   saveAndGen(); break;
    case 'copy-url':       copyURL(); break;
    case 'remove-line':    removeLine(Number(actionTarget.dataset.lineId)); break;
    case 'toggle-style':   toggleLineStyle(Number(actionTarget.dataset.lineId), actionTarget.dataset.field); break;
    case 'set-align':
      updateLineProperty(Number(actionTarget.dataset.lineId), 'align', actionTarget.dataset.align);
      renderStyleBlocks();
      break;
    case 'set-color':
      updateLineProperty(Number(actionTarget.dataset.lineId), 'color', actionTarget.dataset.color);
      renderStyleBlocks();
      break;
    default: break;
  }
};

const handleLinesInput = (event) => {
  const input = event.target;
  if (!input.matches('.line-input')) return;
  updateLineProperty(Number(input.dataset.lineId), 'text', input.value);
};

const handleStyleInput = (event) => {
  const input = event.target;
  if (!input.matches('.style-input')) return;
  const lineId = Number(input.dataset.lineId);
  const field  = input.dataset.field;
  const value  = input.type === 'number' ? Number(input.value) : input.value;
  updateLineProperty(lineId, field, value);
  renderStyleBlocks();
};

const bootFromStoredBoard = async () => {
  const searchParams = new URLSearchParams(location.search);
  state.boardId = searchParams.get('id') || 'default';
  updatePermanentUrlUI();
  const dataEndpoint = state.boardId === 'default' ? '/data' : `/data/${encodeURIComponent(state.boardId)}`;
  try {
    const response = await fetch(dataEndpoint);
    if (!response.ok) return;
    const board = await response.json();
    state.lines    = (board.lines || []).map((line) => ({ id: Date.now() + Math.random(), ...line }));
    state.widthFt  = Number(board.widthFt)  || DEFAULT_STATE.widthFt;
    state.heightFt = Number(board.heightFt) || DEFAULT_STATE.heightFt;
    for (const [category, configs] of Object.entries(LED_CONFIG)) {
      const entry = Object.entries(configs).find(([code, config]) => code === board.pitchCode || config.mm === board.pixelPitch);
      if (entry) {
        const [code, config] = entry;
        state.selectedPitch = { code, category, pixels: config.pixels, mm: config.mm };
        break;
      }
    }
  } catch (_err) { /* use defaults */ }
};

const init = async () => {
  cacheElements();
  document.body.addEventListener('click', handleBodyClick);
  elements.linesList?.addEventListener('input', handleLinesInput);
  elements.styleBlocks?.addEventListener('input', handleStyleInput);
  elements.sw?.addEventListener('input', livePreview);
  elements.sh?.addEventListener('input', livePreview);
  window.addEventListener('resize', () => {
    if (document.getElementById('p5')?.classList.contains('active')) renderLayoutLivePreview();
    if (document.getElementById('p6')?.classList.contains('active')) renderPreview();
  });
  await bootFromStoredBoard();
  await checkLiveAPI();
  buildPitchGrid();
  buildSizePresets();
  syncSizeInputs();
  renderLines();
  renderStyleBlocks();
  loadRecent();
  livePreview();
};

document.addEventListener('DOMContentLoaded', init);