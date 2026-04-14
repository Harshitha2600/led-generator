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
  fontFamily: FONTS[0].v,
  color: '#ffffff',
  bold: true,
  italic: false,
  underline: false,
  align: 'center',
  animMode: 'static',
  animSpeed: 5,
  letterSpacing: 2,
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
  if (pageNumber === 5) updateCanvasSizes();
  if (pageNumber === 6) updateCanvasSizes();
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
  updatePixelNote();
};

const updateLineProperty = (lineId, key, value) => {
  const line = state.lines.find((entry) => entry.id === lineId);
  if (!line) return;
  line[key] = value;
  if (key === 'text') renderStyleBlocks();
};

const toggleLineStyle = (lineId, styleKey) => {
  const line = state.lines.find((entry) => entry.id === lineId);
  if (!line) return;
  line[styleKey] = !line[styleKey];
  renderStyleBlocks();
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
  updatePixelNote();
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
              <div class="ctrl-label">Animation Mode</div>
              <select class="cselect style-input" data-line-id="${line.id}" data-field="animMode">
                <option value="static" ${line.animMode === 'static' ? 'selected' : ''}>Static</option>
                <option value="scroll-left" ${line.animMode === 'scroll-left' ? 'selected' : ''}>Scroll Left</option>
                <option value="scroll-right" ${line.animMode === 'scroll-right' ? 'selected' : ''}>Scroll Right</option>
                <option value="scroll-up" ${line.animMode === 'scroll-up' ? 'selected' : ''}>Scroll Up</option>
                <option value="pulse" ${line.animMode === 'pulse' ? 'selected' : ''}>Zoom / Pulse</option>
                <option value="fade" ${line.animMode === 'fade' ? 'selected' : ''}>Fade In / Out</option>
                <option value="bounce" ${line.animMode === 'bounce' ? 'selected' : ''}>Bounce Inside</option>
              </select>
            </div>
            <div class="ctrl">
              <div class="ctrl-label">Anim Speed (1-10)</div>
              <input type="range" class="cinput style-input" data-line-id="${line.id}" data-field="animSpeed" value="${line.animSpeed || 5}" min="1" max="10">
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
    { label: '2x2 ft\nSquare sign', data: { w: 2, h: 2 } },
    { label: '6x1 ft\nBanner', data: { w: 6, h: 1 } },
    { label: '10x2 ft\nStorefront', data: { w: 10, h: 2 } },
    { label: '8x4 ft\nBillboard', data: { w: 8, h: 4 } },
    { label: '16x9 ft\nStage screen', data: { w: 16, h: 9 } },
    { label: '20x10 ft\nOutdoor large', data: { w: 20, h: 10 } },
    { label: '24x4 ft\nExtra long', data: { w: 24, h: 4 } },
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
};

const getBoardSpec = () => {
  const widthFt = Math.max(0.5, Number(elements.sw?.value || state.widthFt) || 6);
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
  
  if (elements.sizeTag)   elements.sizeTag.textContent  = `${widthFt} x ${heightFt} ft`;
  if (elements.pitchTag)  elements.pitchTag.textContent = state.selectedPitch.code;
  if (elements.pixelInfo) elements.pixelInfo.textContent = `${ledCols} x ${ledRows} LED px`;
};

// ─── HIGH PERFORMANCE CANVAS ANIMATION ENGINE ─────────────────────────────

const setupCanvasWrap = (canvas, wrap, stage) => {
  if (!canvas || !wrap || !stage) return;
  const { widthFt, heightFt } = getBoardSpec();
  const aspect = widthFt / heightFt;

  canvas.width = 3000; // Extreme high-res internal rendering buffer
  canvas.height = 3000 / aspect;
  
  const padding = 80; 
  const stageW = (stage.clientWidth || window.innerWidth) - padding;
  const stageH = (stage.clientHeight || (window.innerHeight - 160)) - padding;
  
  let cw, ch;
  if (stageW / stageH > aspect) { 
      ch = stageH; 
      cw = ch * aspect; 
  } else { 
      cw = stageW; 
      ch = cw / aspect; 
  }

  wrap.style.width = `${cw}px`;
  wrap.style.height = `${ch}px`;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
};

const updateCanvasSizes = () => {
  updatePixelNote();
  if (document.getElementById('p5')?.classList.contains('active')) {
    setupCanvasWrap(elements.layoutLiveCanvas, elements.layoutLiveCanvas?.parentElement, elements.layoutLiveCanvas?.parentElement?.parentElement);
    if (elements.layoutPreviewInfo) elements.layoutPreviewInfo.textContent = `Live Preview | ${state.widthFt}x${state.heightFt} ft`;
  }
  if (document.getElementById('p6')?.classList.contains('active')) {
    setupCanvasWrap(elements.boardCanvas, elements.boardWrap, elements.stage);
  }
};

// ============================================================================
// CORE RENDERING FIX: 100% FLUSH PERFECT AUTO-FIT ALGORITHM + ANIMATIONS
// ============================================================================
const renderFrame = (ctx, canvasW, canvasH, lines, t) => {
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const activeLines = lines.filter((l) => l.text.trim());
  if (!activeLines.length) return;

  const sectionHeight = canvasH / activeLines.length;

  activeLines.forEach((line, i) => {
    // We target 96% of the screen so it touches the absolute edge without clipping the anti-aliasing
    const targetW = canvasW * 0.96;
    const targetH = sectionHeight * 0.96;

    let minFont = 10;
    let maxFont = Math.max(targetW, targetH) * 3; // Allow massive fonts for short text
    let bestFontSize = minFont;
    let bestWrappedLines = [line.text];
    
    // Add letter spacing to the canvas natively if supported
    ctx.letterSpacing = `${line.letterSpacing || 2}px`;

    const getFontStr = (size) => `${line.bold ? 'bold ' : ''}${line.italic ? 'italic ' : ''}${size}px ${line.fontFamily}`.trim();

    // 1. PRECISION BINARY SEARCH: Find perfect font size that wraps text to fit aspect ratio
    for (let iter = 0; iter < 25; iter++) {
      let testSize = (minFont + maxFont) / 2;
      ctx.font = getFontStr(testSize);

      let wordsArr = line.text.split(' ').filter(w => w !== '');
      if(wordsArr.length === 0) break;

      let wrappedLines = [];
      let currentLine = wordsArr[0];

      for (let w = 1; w < wordsArr.length; w++) {
        let word = wordsArr[w];
        let width = ctx.measureText(currentLine + " " + word).width;
        if (width <= targetW) {
            currentLine += " " + word;
        } else {
            wrappedLines.push(currentLine);
            currentLine = word;
        }
      }
      wrappedLines.push(currentLine);

      // Tight line height for perfect flush look
      let lineHeight = testSize * 1.05;
      let totalHeight = wrappedLines.length * lineHeight;
      
      let maxWidth = 0;
      for (let wl of wrappedLines) {
          maxWidth = Math.max(maxWidth, ctx.measureText(wl).width);
      }

      if (totalHeight <= targetH && maxWidth <= targetW) {
          bestFontSize = testSize;
          bestWrappedLines = wrappedLines;
          minFont = testSize; // We can go bigger
      } else {
          maxFont = testSize; // We must go smaller
      }
    }

    // 2. MICRO-SCALING TO ELIMINATE GAPS (100% Flush to edges)
    ctx.font = getFontStr(bestFontSize);
    const lineHeight = bestFontSize * 1.05;
    
    let exactBlockWidth = 0;
    let blockHeight = 0;
    
    // Measure exact optical height of all wrapped lines combined
    bestWrappedLines.forEach((wl) => {
        const metrics = ctx.measureText(wl);
        exactBlockWidth = Math.max(exactBlockWidth, metrics.width);
        // Fallback calculation for older browsers
        const h = (metrics.actualBoundingBoxAscent || (bestFontSize * 0.8)) + (metrics.actualBoundingBoxDescent || (bestFontSize * 0.2));
        blockHeight += h;
    });

    // Add inter-line spacing to block height
    blockHeight += (bestWrappedLines.length - 1) * (lineHeight - bestFontSize);
    if (blockHeight <= 0) blockHeight = 1;
    if (exactBlockWidth <= 0) exactBlockWidth = 1;

    // Independent flush stretch (eliminates any left/right/top/bottom padding gaps)
    let scaleX = targetW / exactBlockWidth;
    let scaleY = targetH / blockHeight;

    // 3. ANIMATION LOGIC
    let alpha = 1;
    let drawX = 0;
    let drawY = 0;
    const speed = Number(line.animSpeed) || 5;
    const animMode = line.animMode || 'static';

    if (animMode === 'fade') {
        alpha = (Math.sin(t * speed * 0.5) + 1) / 2;
    } else if (animMode === 'scroll-left') {
        const travel = canvasW + (exactBlockWidth * scaleX);
        const duration = travel / (speed * 200);
        const progress = (t % duration) / duration;
        drawX = (travel / 2) - (progress * travel);
    } else if (animMode === 'scroll-right') {
        const travel = canvasW + (exactBlockWidth * scaleX);
        const duration = travel / (speed * 200);
        const progress = (t % duration) / duration;
        // Start from off-screen left and move to off-screen right
        drawX = -(travel / 2) + (progress * travel); 
    } else if (animMode === 'scroll-up') {
        const travel = sectionHeight + (blockHeight * scaleY);
        const duration = travel / (speed * 150);
        const progress = (t % duration) / duration;
        drawY = (travel / 2) - (progress * travel);
    } else if (animMode === 'bounce') {
        // Shrink slightly so it actually has room to bounce around
        scaleX *= 0.70;
        scaleY *= 0.70;
        const maxOffsetX = (canvasW / 2) - (exactBlockWidth * scaleX / 2) - (canvasW * 0.05);
        drawX = Math.sin(t * speed * 0.8) * maxOffsetX; 
    }

    // 4. DRAW TEXT WITH OPTICAL CENTERING
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = line.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Handle Pulse Animation scaling
    if (animMode === 'pulse') {
        const pulse = 1 + 0.1 * Math.sin(t * speed);
        scaleX *= pulse;
        scaleY *= pulse;
    }

    const sectionCenterY = (i * sectionHeight) + (sectionHeight / 2);
    
    // Move canvas context to exact center
    ctx.translate((canvasW / 2) + drawX, sectionCenterY + drawY);
    ctx.scale(scaleX, scaleY);

    // Calculate optical start Y based on actual font bounding box
    const totalOpticalHeight = bestWrappedLines.length * lineHeight;
    const startY = -(totalOpticalHeight / 2) + (lineHeight / 2);

    bestWrappedLines.forEach((wl, lIdx) => {
         const m = ctx.measureText(wl);
         const opticalCorrection = m.actualBoundingBoxAscent ? (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 : 0;
         ctx.fillText(wl, 0, startY + (lIdx * lineHeight) + opticalCorrection);
    });

    ctx.restore();
  });
};

// Global Animation Loop
const animationLoop = () => {
  const t = performance.now() / 1000; 

  if (document.getElementById('p5')?.classList.contains('active') && elements.layoutLiveCanvas) {
    const ctx = elements.layoutLiveCanvas.getContext('2d');
    renderFrame(ctx, elements.layoutLiveCanvas.width, elements.layoutLiveCanvas.height, state.lines, t);
  }
  
  if (document.getElementById('p6')?.classList.contains('active') && elements.boardCanvas) {
    const ctx = elements.boardCanvas.getContext('2d');
    renderFrame(ctx, elements.boardCanvas.width, elements.boardCanvas.height, state.lines, t);
  }

  requestAnimationFrame(animationLoop);
};

// ─── UTILITIES & NETWORKING ──────────────────────────────────────────────────

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


// ─── STANDALONE HTML GENERATOR (BUNDLES 100% FLUSH ENGINE) ────────────
const dlHTML = () => {
  const activeLines = state.lines.filter((line) => line.text.trim());
  const { widthFt, heightFt } = getBoardSpec();
  const aspect = widthFt / heightFt;
  
  const linesJSON = JSON.stringify(activeLines.map(l => ({
    text: l.text, color: l.color, fontFamily: l.fontFamily, 
    bold: l.bold, italic: l.italic, animMode: l.animMode, animSpeed: l.animSpeed
  })));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LED Board - Animated Auto-Fit</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Syne:wght@700;800&family=Oswald:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; background-color: #000000 !important; overflow: hidden; }
    canvas { display: block; width: 100vw; height: 100vh; object-fit: fill; }
  </style>
</head>
<body>
  <canvas id="stage"></canvas>
  <script>
    const lines = ${linesJSON};
    const canvas = document.getElementById('stage');
    const ctx = canvas.getContext('2d');
    
    function resize() {
      canvas.width = 3000;
      canvas.height = 3000 / ${aspect};
    }
    
    window.addEventListener('resize', resize);
    resize();

    function renderLoop(time) {
      const t = time / 1000;
      const canvasW = canvas.width;
      const canvasH = canvas.height;
      
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasW, canvasH);

      const sectionHeight = canvasH / lines.length;

      lines.forEach((line, i) => {
        const targetW = canvasW * 0.96;
        const targetH = sectionHeight * 0.96;

        let minFont = 10;
        let maxFont = Math.max(targetW, targetH) * 3;
        let bestFontSize = minFont;
        let bestWrappedLines = [line.text];
        
        ctx.letterSpacing = "2px";
        const getFontStr = (size) => \`\${line.bold ? 'bold ' : ''}\${line.italic ? 'italic ' : ''}\${size}px \${line.fontFamily}\`.trim();

        for (let iter = 0; iter < 25; iter++) {
          let testSize = (minFont + maxFont) / 2;
          ctx.font = getFontStr(testSize);

          let wordsArr = line.text.split(' ').filter(w => w !== '');
          if(wordsArr.length === 0) break;

          let wrappedLines = [];
          let currentLine = wordsArr[0];

          for (let w = 1; w < wordsArr.length; w++) {
            let word = wordsArr[w];
            let width = ctx.measureText(currentLine + " " + word).width;
            if (width <= targetW) {
                currentLine += " " + word;
            } else {
                wrappedLines.push(currentLine);
                currentLine = word;
            }
          }
          wrappedLines.push(currentLine);

          let lineHeight = testSize * 1.05;
          let totalHeight = wrappedLines.length * lineHeight;
          
          let maxWidth = 0;
          for (let wl of wrappedLines) {
              maxWidth = Math.max(maxWidth, ctx.measureText(wl).width);
          }

          if (totalHeight <= targetH && maxWidth <= targetW) {
              bestFontSize = testSize;
              bestWrappedLines = wrappedLines;
              minFont = testSize;
          } else {
              maxFont = testSize;
          }
        }

        ctx.font = getFontStr(bestFontSize);
        const lineHeight = bestFontSize * 1.05;
        
        let exactBlockWidth = 0;
        let blockHeight = 0;
        
        bestWrappedLines.forEach((wl) => {
            const metrics = ctx.measureText(wl);
            exactBlockWidth = Math.max(exactBlockWidth, metrics.width);
            const h = (metrics.actualBoundingBoxAscent || (bestFontSize * 0.8)) + (metrics.actualBoundingBoxDescent || (bestFontSize * 0.2));
            blockHeight += h;
        });

        blockHeight += (bestWrappedLines.length - 1) * (lineHeight - bestFontSize);
        if (blockHeight <= 0) blockHeight = 1;
        if (exactBlockWidth <= 0) exactBlockWidth = 1;

        let scaleX = targetW / exactBlockWidth;
        let scaleY = targetH / blockHeight;

        let alpha = 1; let drawX = 0; let drawY = 0;
        const speed = Number(line.animSpeed) || 5;
        const animMode = line.animMode || 'static';

        if (animMode === 'fade') alpha = (Math.sin(t * speed * 0.5) + 1) / 2;
        else if (animMode === 'scroll-left') {
            const travel = canvasW + (exactBlockWidth * scaleX);
            const duration = travel / (speed * 200);
            const progress = (t % duration) / duration;
            drawX = (travel / 2) - (progress * travel);
        } else if (animMode === 'scroll-right') {
            const travel = canvasW + (exactBlockWidth * scaleX);
            const duration = travel / (speed * 200);
            const progress = (t % duration) / duration;
            drawX = -(travel / 2) + (progress * travel);
        } else if (animMode === 'scroll-up') {
            const travel = sectionHeight + (blockHeight * scaleY);
            const duration = travel / (speed * 150);
            const progress = (t % duration) / duration;
            drawY = (travel / 2) - (progress * travel);
        } else if (animMode === 'bounce') {
            scaleX *= 0.70; scaleY *= 0.70;
            const maxOffsetX = (canvasW / 2) - (exactBlockWidth * scaleX / 2) - (canvasW * 0.05);
            drawX = Math.sin(t * speed * 0.8) * maxOffsetX; 
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = line.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (animMode === 'pulse') {
            const pulse = 1 + 0.1 * Math.sin(t * speed);
            scaleX *= pulse;
            scaleY *= pulse;
        }

        const sectionCenterY = (i * sectionHeight) + (sectionHeight / 2);
        ctx.translate((canvasW / 2) + drawX, sectionCenterY + drawY);
        ctx.scale(scaleX, scaleY);

        const totalOpticalHeight = bestWrappedLines.length * lineHeight;
        const startY = -(totalOpticalHeight / 2) + (lineHeight / 2);

        bestWrappedLines.forEach((wl, lIdx) => {
             const m = ctx.measureText(wl);
             const opticalCorrection = m.actualBoundingBoxAscent ? (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 : 0;
             ctx.fillText(wl, 0, startY + (lIdx * lineHeight) + opticalCorrection);
        });

        ctx.restore();
      });

      requestAnimationFrame(renderLoop);
    }
    
    document.fonts.ready.then(() => requestAnimationFrame(renderLoop));
  </script>
</body>
</html>`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  link.download = `led_animated_board.html`;
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
      updateCanvasSizes();
      break;
    case 'download-html':  dlHTML(); break;
    case 'save-and-gen':   saveAndGen(); break;
    case 'copy-url':       copyURL(); break;
    case 'remove-line':    removeLine(Number(actionTarget.dataset.lineId)); break;
    case 'toggle-style':   toggleLineStyle(Number(actionTarget.dataset.lineId), actionTarget.dataset.field); break;
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
  const value  = input.type === 'number' || input.type === 'range' ? Number(input.value) : input.value;
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
    state.lines    = (board.lines || []).map((line) => ({ id: Date.now() + Math.random(), animSpeed: 5, animMode: 'static', ...line }));
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
  elements.sw?.addEventListener('input', updateCanvasSizes);
  elements.sh?.addEventListener('input', updateCanvasSizes);
  window.addEventListener('resize', updateCanvasSizes);
  
  await bootFromStoredBoard();
  await checkLiveAPI();
  buildPitchGrid();
  buildSizePresets();
  syncSizeInputs();
  renderLines();
  renderStyleBlocks();
  loadRecent();
  
  requestAnimationFrame(animationLoop);
};

document.addEventListener('DOMContentLoaded', init);