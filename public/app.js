const API = '/api/boards';
const TEXT_COLORS = ['#ffffff','#ffff00','#00c3ff','#ff6b00','#00e676','#ff4081','#e040fb','#000000'];
const FONTS = [
  {n:'DM Sans',     v:"'DM Sans',sans-serif"},
  {n:'Oswald',      v:"'Oswald',sans-serif"},
  {n:'Syne',        v:"'Syne',sans-serif"},
  {n:'Impact',      v:'Impact,sans-serif'},
  {n:'Georgia',     v:'Georgia,serif'},
  {n:'Courier New', v:"'Courier New',monospace"},
  {n:'Arial Black', v:"'Arial Black',sans-serif"},
];
const LED_CONFIG = {
  indoor: {
    P4: { pitch: 4, mm: 4, pixels: { w: 80, h: 40 }, label: 'Indoor professional' },
    P3: { pitch: 3, mm: 3, pixels: { w: 64, h: 64 }, label: 'Professional grade' },
    'P2.5': { pitch: 2.5, mm: 2.5, pixels: { w: 128, h: 64 }, label: 'High-res indoor' },
    P2: { pitch: 2, mm: 2, pixels: { w: 160, h: 80 }, label: 'Ultra high-res' },
    'P1.5': { pitch: 1.5, mm: 1.5, pixels: { w: 174, h: 87 }, label: 'Premium high-res' },
  },
  outdoor: {
    P10: { pitch: 10, mm: 10, pixels: { w: 32, h: 16 }, label: 'Outdoor advertising' },
    P5: { pitch: 5, mm: 5, pixels: { w: 64, h: 32 }, label: 'Outdoor medium-res' },
    P4: { pitch: 4, mm: 4, pixels: { w: 80, h: 40 }, label: 'Outdoor professional' },
    P3: { pitch: 3, mm: 3, pixels: { w: 64, h: 64 }, label: 'High-res outdoor' },
  },
};
let state = {
  lines: [],
  currentSlug: null,
  selectedPitch: { code: 'P10', category: 'outdoor', pixels: { w: 32, h: 16 } },
  contentType: 'text',
  imageFile: null,
  imageURL: '',
  imageBase64: '',
};
let layout = {
  posX: 0,
  posY: 0,
  scaleX: 1,
  scaleY: 1,
};
const elements = {};

const cacheElements = () => {
  elements.dbPill = document.getElementById('db-pill');
  elements.dbLabel = document.getElementById('db-label');
  elements.pages = document.querySelectorAll('.page');
  elements.linesList = document.getElementById('lines-list');
  elements.styleBlocks = document.getElementById('style-blocks');
  elements.imageUpload = document.getElementById('image-upload');
  elements.imageUrl = document.getElementById('image-url');
  elements.imageName = document.getElementById('image-name');
  elements.imagePreview = document.getElementById('image-preview');
  elements.pitchGrid = document.getElementById('pitch-grid');
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
  elements.pitchSpecs = document.getElementById('pitch-specs');
  elements.urlShow = document.getElementById('url-show');
  elements.openLink = document.getElementById('open-link');
  elements.overlay = document.getElementById('overlay');
  elements.layoutControlsPanel = document.getElementById('layout-controls-panel');
  elements.layoutImageNotice = document.getElementById('layout-image-notice');
  elements.layoutLiveCanvas = document.getElementById('layout-live-canvas');
  elements.layoutLivePosX = document.getElementById('layout-live-posX');
  elements.layoutLivePosY = document.getElementById('layout-live-posY');
  elements.layoutLiveScaleX = document.getElementById('layout-live-scaleX');
  elements.layoutLiveScaleY = document.getElementById('layout-live-scaleY');
  elements.layoutLivePosXVal = document.getElementById('layout-live-posX-value');
  elements.layoutLivePosYVal = document.getElementById('layout-live-posY-value');
  elements.layoutLiveScaleXVal = document.getElementById('layout-live-scaleX-value');
  elements.layoutLiveScaleYVal = document.getElementById('layout-live-scaleY-value');
  elements.layoutPreviewInfo = document.getElementById('layout-preview-info');
  elements.ovText = document.getElementById('ov-text');
  elements.resultBar = document.getElementById('result-bar');
  elements.copyBtn = document.getElementById('copy-btn');
};

const showPage = (pageNumber) => {
  elements.pages.forEach(page => page.classList.remove('active'));
  const target = document.getElementById(`p${pageNumber}`);
  if (target) target.classList.add('active');
  if (pageNumber === 1) loadRecent();
  if (pageNumber === 5) {
    console.log('Layout page opened');
    updateLayoutUI();
    setTimeout(() => {
      renderLayoutLivePreview();
    }, 100);
  }
  if (pageNumber === 6) renderPreview();
};

const setPill = (ok) => {
  if (!elements.dbPill || !elements.dbLabel) return;
  elements.dbPill.className = `db-pill ${ok ? 'ok' : 'err'}`;
  elements.dbLabel.textContent = ok ? 'MongoDB OK' : 'DB offline';
};

const checkDB = async () => {
  try {
    await fetch(API);
    setPill(true);
  } catch {
    setPill(false);
  }
};

const createLine = () => ({
  id: Date.now() + Math.random(),
  text: '',
  fontSize: 80,
  fontFamily: FONTS[0].v,
  color: '#ffffff',
  bold: false,
  italic: false,
  underline: false,
  align: 'center',
  letterSpacing: 0,
});

const addLine = () => {
  state.lines.push(createLine());
  renderLines();
  renderStyleBlocks();
};

const removeLine = (lineId) => {
  if (state.lines.length <= 1) return;
  state.lines = state.lines.filter(line => line.id !== lineId);
  renderLines();
  renderStyleBlocks();
  livePreview();
};

const updateLineProperty = (lineId, key, value) => {
  const line = state.lines.find(line => line.id === lineId);
  if (!line) return;
  line[key] = value;
  if (key === 'text') {
    renderStyleBlocks();
  }
  livePreview();
};

const toggleLineStyle = (lineId, styleKey) => {
  const line = state.lines.find(line => line.id === lineId);
  if (!line) return;
  line[styleKey] = !line[styleKey];
  renderStyleBlocks();
  livePreview();
};

const setContentType = (type) => {
  state.contentType = type;
  document.getElementById('btn-text').classList.toggle('active', type === 'text');
  document.getElementById('btn-image').classList.toggle('active', type === 'image');
  document.getElementById('btn-url').classList.toggle('active', type === 'url');

  document.getElementById('text-inputs').style.display = type === 'text' ? 'block' : 'none';
  document.getElementById('image-inputs').style.display = type === 'image' ? 'block' : 'none';
  document.getElementById('url-inputs').style.display = type === 'url' ? 'block' : 'none';
  
  if (elements.layoutControlsPanel) elements.layoutControlsPanel.style.display = type === 'text' ? 'block' : 'none';
  if (elements.layoutImageNotice) elements.layoutImageNotice.style.display = type === 'text' ? 'none' : 'block';
  
  livePreview();
};

const startNew = () => {
  state.lines = [createLine()];
  state.currentSlug = null;
  state.contentType = 'text';
  state.imageFile = null;
  state.imageURL = '';
  state.imageBase64 = '';
  if (elements.imageName) elements.imageName.textContent = '';
  if (elements.imagePreview) elements.imagePreview.textContent = 'No image selected.';
  setContentType('text');
  addLine();
  showPage(2);
  renderLines();
  renderStyleBlocks();
};

const goToStyle = () => {
  if (state.contentType !== 'text') {
    showPage(4);
    return;
  }
  if (!state.lines.some(line => line.text.trim())) {
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

  state.lines.filter(line => line.text.trim()).forEach((line, index) => {
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
            <div class="ctrl-label">Font Size (LED px)</div>
            <input type="number" class="cinput style-input" data-line-id="${line.id}" data-field="fontSize" value="${line.fontSize}" min="10" max="800" step="2">
          </div>
          <div class="ctrl">
            <div class="ctrl-label">Letter Spacing (px)</div>
            <input type="number" class="cinput style-input" data-line-id="${line.id}" data-field="letterSpacing" value="${line.letterSpacing}" min="-5" max="80" step="1">
          </div>
        </div>
        <div class="ctrl">
          <div class="ctrl-label">Font Family</div>
          <select class="cselect style-input" data-line-id="${line.id}" data-field="fontFamily">
            ${FONTS.map(font => `<option value="${font.v}" ${line.fontFamily === font.v ? 'selected' : ''}>${font.n}</option>`).join('')}
          </select>
        </div>
        <div class="ctrl">
          <div class="ctrl-label">Text Color</div>
          <div class="color-row">
            <input type="color" class="cswatch" data-line-id="${line.id}" data-field="color" value="${line.color}">
            <div class="cprow">
              ${TEXT_COLORS.map(color => `<button type="button" class="cp" data-action="set-color" data-line-id="${line.id}" data-color="${color}" style="background:${color};border:2px solid #444"></button>`).join('')}
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

const buildPitchGrid = () => {
  // Build indoor pitch grid
  if (elements.indoorGrid) {
    elements.indoorGrid.innerHTML = Object.entries(LED_CONFIG.indoor).map(([code, config]) => `
    <button type="button" class="pitch-btn${state.selectedPitch.code === code && state.selectedPitch.category === 'indoor' ? ' sel' : ''}" data-action="select-pitch" data-pitch="${code}" data-category="indoor" id="pb-${code.replace('.', '_')}">
      <span class="pitch-code">${code}</span>
      <span class="pitch-mm">${config.mm}mm</span>
      <span class="pitch-use">Indoor</span>
      <span class="pitch-res">${config.pixels.w} x ${config.pixels.h} px</span>
    </button>
  `).join('');
  }
  
  // Build outdoor pitch grid
  if (elements.outdoorGrid) {
    elements.outdoorGrid.innerHTML = Object.entries(LED_CONFIG.outdoor).map(([code, config]) => `
    <button type="button" class="pitch-btn${state.selectedPitch.code === code && state.selectedPitch.category === 'outdoor' ? ' sel' : ''}" data-action="select-pitch" data-pitch="${code}" data-category="outdoor" id="pb-${code.replace('.', '_')}">
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
  elements.sizePresets.innerHTML = presets.map(p => `
    <button type="button" class="pset" data-action="set-size" data-width="${p.data.w}" data-height="${p.data.h}">${p.label}</button>
  `).join('');
};

const selectPitch = (code, category) => {
  const config = category === 'indoor' ? LED_CONFIG.indoor[code] : LED_CONFIG.outdoor[code];
  if (config) {
    state.selectedPitch = {
      code,
      category,
      pixels: config.pixels,
      mm: config.mm,
    };
  }
  // Update button selection
  document.querySelectorAll('.pitch-btn').forEach(button => {
    const isSel = button.dataset.pitch === code && button.dataset.category === category;
    button.classList.toggle('sel', isSel);
  });
  updatePixelNote();
  livePreview();
};

const calculateSize = (preset) => ({
  widthFt: (preset.width * preset.pitch) / 304.8,
  heightFt: (preset.height * preset.pitch) / 304.8,
});

const updatePixelNote = () => {
  if (!elements.pixelNote) return;
  const W = parseFloat(elements.sw?.value) || 6;
  const H = parseFloat(elements.sh?.value) || 1;
  const pitch = state.selectedPitch;
  if (!pitch || !pitch.pixels) return;
  const cols = pitch.pixels.w;
  const rows = pitch.pixels.h;
  elements.pixelNote.textContent = `${W}x${H} ft with ${pitch.code} = ${cols} x ${rows} LED pixels (${(cols * rows).toLocaleString()} total)`;
};

const updateLayoutUI = () => {
  if (elements.layoutLivePosXVal) elements.layoutLivePosXVal.textContent = layout.posX.toString();
  if (elements.layoutLivePosYVal) elements.layoutLivePosYVal.textContent = layout.posY.toString();
  if (elements.layoutLiveScaleXVal) elements.layoutLiveScaleXVal.textContent = layout.scaleX.toFixed(2);
  if (elements.layoutLiveScaleYVal) elements.layoutLiveScaleYVal.textContent = layout.scaleY.toFixed(2);
  if (elements.layoutLivePosX) elements.layoutLivePosX.value = layout.posX.toString();
  if (elements.layoutLivePosY) elements.layoutLivePosY.value = layout.posY.toString();
  if (elements.layoutLiveScaleX) elements.layoutLiveScaleX.value = layout.scaleX.toString();
  if (elements.layoutLiveScaleY) elements.layoutLiveScaleY.value = layout.scaleY.toString();
};

const handleLayoutInput = (event) => {
  const target = event.target;
  if (!target.matches('.layout-input')) return;
  const value = parseFloat(target.value) || 0;
  switch (target.name) {
    case 'posX':
      layout.posX = value;
      break;
    case 'posY':
      layout.posY = value;
      break;
    case 'scaleX':
      layout.scaleX = value;
      break;
    case 'scaleY':
      layout.scaleY = value;
      break;
    default:
      return;
  }
  updateLayoutUI();
  livePreview();
};

const resetLayout = () => {
  layout = { posX: 0, posY: 0, scaleX: 1, scaleY: 1 }; 
  updateLayoutUI();
  livePreview();
};

const fitToWidth = () => {
  const canvas = elements.boardCanvas;
  if (!canvas) return;
  const img = new Image();
  const activeLines = state.lines.filter(line => line.text.trim());
  if (state.contentType === 'image' && state.imageFile) {
    img.src = URL.createObjectURL(state.imageFile);
    img.onload = () => {
      layout.scaleX = canvas.width / img.width;
      updateLayoutUI();
      livePreview();
      URL.revokeObjectURL(img.src);
    };
    return;
  }
  if (state.contentType === 'url' && state.imageURL.trim()) {
    img.crossOrigin = 'anonymous';
    img.src = state.imageURL;
    img.onload = () => {
      layout.scaleX = canvas.width / img.width;
      updateLayoutUI();
      livePreview();
    };
    return;
  }
  if (state.contentType === 'text') {
    layout.scaleX = canvas.width / 200;
    updateLayoutUI();
    livePreview();
  }
};

const fitToHeight = () => {
  const canvas = elements.boardCanvas;
  if (!canvas) return;
  const img = new Image();
  if (state.contentType === 'image' && state.imageFile) {
    img.src = URL.createObjectURL(state.imageFile);
    img.onload = () => {
      layout.scaleY = canvas.height / img.height;
      updateLayoutUI();
      livePreview();
      URL.revokeObjectURL(img.src);
    };
    return;
  }
  if (state.contentType === 'url' && state.imageURL.trim()) {
    img.crossOrigin = 'anonymous';
    img.src = state.imageURL;
    img.onload = () => {
      layout.scaleY = canvas.height / img.height;
      updateLayoutUI();
      livePreview();
    };
    return;
  }
  if (state.contentType === 'text') {
    layout.scaleY = canvas.height / 200;
    updateLayoutUI();
    livePreview();
  }
};

const fitToBoard = () => {
  const canvas = elements.boardCanvas;
  if (!canvas) return;
  const img = new Image();
  const applyFit = (sourceWidth, sourceHeight) => {
    const ratio = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
    layout.scaleX = ratio;
    layout.scaleY = ratio;
    updateLayoutUI();
    livePreview();
  };
  if (state.contentType === 'image' && state.imageFile) {
    img.src = URL.createObjectURL(state.imageFile);
    img.onload = () => {
      applyFit(img.width, img.height);
      URL.revokeObjectURL(img.src);
    };
    return;
  }
  if (state.contentType === 'url' && state.imageURL.trim()) {
    img.crossOrigin = 'anonymous';
    img.src = state.imageURL;
    img.onload = () => applyFit(img.width, img.height);
    return;
  }
  if (state.contentType === 'text') {
    const width = canvas.width;
    const height = canvas.height;
    const ratio = Math.min(width / 200, height / 200);
    layout.scaleX = ratio;
    layout.scaleY = ratio;
    updateLayoutUI();
    livePreview();
  }
};

const copyURL = () => {
  const url = elements.urlShow?.textContent;
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    if (!elements.copyBtn) return;
    elements.copyBtn.textContent = 'Copied!';
    elements.copyBtn.classList.add('ok');
    setTimeout(() => {
      elements.copyBtn.textContent = 'Copy';
      elements.copyBtn.classList.remove('ok');
    }, 2000);
  });
};

const handleImageChange = async (event) => {
  const file = event.target?.files?.[0] || null;
  state.imageFile = null;
  state.imageBase64 = '';
  if (elements.imageName) elements.imageName.textContent = '';
  if (elements.imagePreview) elements.imagePreview.textContent = 'No image selected.';

  if (!file) return;
  if (!file.type.startsWith('image/') || (!file.type.includes('png') && !file.type.includes('jpg') && !file.type.includes('jpeg'))) {
    window.alert('Only PNG or JPG images are allowed.');
    return;
  }

  state.imageFile = file;
  if (elements.imageName) elements.imageName.textContent = file.name;
  if (elements.imagePreview) elements.imagePreview.textContent = 'Image selected — preview will appear in the board preview step.';

  try {
    state.imageBase64 = await fileToDataURL(file);
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
  }
  livePreview();
};

const handleURLChange = async (value) => {
  state.imageURL = value;
  state.imageBase64 = '';
  if (value.trim()) {
    try {
      state.imageBase64 = await urlToBase64(value);
    } catch (error) {
      console.error('Failed to convert URL to base64:', error);
    }
  }
  livePreview();
};

const fileToDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Failed to read image file.'));
  reader.readAsDataURL(file);
});

const urlToBase64 = async (url) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert URL to base64:', error);
    return '';
  }
};

const goToPreview = () => {
  renderPreview();
  showPage(6);
};

const renderPreview = () => {
  console.log('RENDER PREVIEW RUNNING', layout, state.contentType);
  try {
    const W = parseFloat(elements.sw?.value) || 6;
    const H = parseFloat(elements.sh?.value) || 1;
    const pitch = state.selectedPitch;
    if (!pitch || !pitch.pixels || !elements.boardCanvas || !elements.boardWrap || !elements.stage) return;

    elements.sizeTag.textContent = `${W} x ${H} ft`;
    elements.pitchTag.textContent = pitch.code;
    elements.pixelInfo.textContent = `${pitch.pixels.w} x ${pitch.pixels.h} LED px`;

    const canvas = elements.boardCanvas;
    const stage = elements.stage;
    const wrap = elements.boardWrap;
    const aspect = W / H;
    canvas.width = 800;
    canvas.height = 600;

    const stageW = stage.clientWidth || window.innerWidth;
    const stageH = stage.clientHeight || (window.innerHeight - 160);
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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state.contentType === 'image') {
      if (!state.imageFile) {
        showPlaceholder(ctx, 'Select an image...');
        return;
      }
      renderImagePreview(canvas, ctx, state.imageFile);
      return;
    }

    if (state.contentType === 'url') {
      if (!state.imageURL.trim()) {
        showPlaceholder(ctx, 'Enter image URL...');
        return;
      }
      renderImagePreview(canvas, ctx, state.imageURL);
      return;
    }

    ctx.save();
    ctx.translate(canvas.width / 2 + layout.posX, canvas.height / 2 + layout.posY);
    ctx.scale(layout.scaleX, layout.scaleY);
    renderTextCanvas(canvas, ctx, true);
    ctx.restore();
  } catch (error) {
    console.error('Preview error:', error);
  }
};

const renderLayoutLivePreview = () => {
  console.log('RENDER LAYOUT LIVE PREVIEW', layout, state.contentType);
  const canvas = elements.layoutLiveCanvas;
  if (!canvas) return;

  const W = parseFloat(elements.sw?.value) || 6;
  const H = parseFloat(elements.sh?.value) || 1;
  const pitch = state.selectedPitch;
  if (!pitch || !pitch.pixels) return;

  const displayWidth = canvas.clientWidth || 400;
  canvas.width = displayWidth;
  canvas.height = Math.max(1, Math.round(displayWidth * (H / W)));

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (elements.layoutPreviewInfo) {
    elements.layoutPreviewInfo.textContent = `${W}x${H} ft | ${pitch.code} | ${pitch.pixels.w}x${pitch.pixels.h} px`;
  }

  if (state.contentType === 'image') {
    if (state.imageFile) renderImagePreview(canvas, ctx, state.imageFile);
    else showPlaceholder(ctx, 'Select image');
    return;
  }

  if (state.contentType === 'url') {
    if (state.imageURL.trim()) renderImagePreview(canvas, ctx, state.imageURL);
    else showPlaceholder(ctx, 'Enter URL');
    return;
  }

  const activeLines = state.lines.filter(line => line.text.trim());
  if (!activeLines.length) {
    showPlaceholder(ctx, 'Add text');
    return;
  }

  ctx.save();
  ctx.translate(canvas.width / 2 + layout.posX, canvas.height / 2 + layout.posY);
  ctx.scale(layout.scaleX, layout.scaleY);
  renderTextCanvas(canvas, ctx, true);
  ctx.restore();
};

const showPlaceholder = (ctx, message) => {
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '1rem sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, 400, 300);
};

const renderTextCanvas = (canvas, ctx, centered = false) => {
  const activeLines = state.lines.filter(line => line.text.trim());
  if (!activeLines.length) {
    showPlaceholder(ctx, 'Add text lines...');
    return;
  }
  const lineHeight = canvas.height / activeLines.length;
  activeLines.forEach((line, index) => {
    const fontSize = Math.max(8, line.fontSize);
    ctx.font = `${line.bold ? 'bold ' : ''}${line.italic ? 'italic ' : ''}${fontSize}px ${line.fontFamily}`.trim();
    ctx.fillStyle = line.color;
    ctx.textAlign = centered ? 'center' : line.align;
    ctx.textBaseline = 'middle';
    const x = centered ? 0 : line.align === 'center' ? canvas.width / 2 : line.align === 'right' ? canvas.width - 20 : 20;
    const y = centered
      ? (index - (activeLines.length - 1) / 2) * lineHeight
      : (index + 0.5) * lineHeight;
    ctx.fillText(line.text, x, y);
  });
};

const drawImageNormal = (img, canvas, ctx) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  ctx.drawImage(img, x, y, w, h);
};

const renderImagePreview = (canvas, ctx, source) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  let objectUrl = null;
  img.onload = () => {
    drawImageNormal(img, canvas, ctx);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };
  img.onerror = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    showPlaceholder(ctx, 'Image failed to load');
  };
  if (typeof source === 'string') {
    img.src = source;
  } else {
    objectUrl = URL.createObjectURL(source);
    img.src = objectUrl;
  }
};

const livePreview = () => {
  updatePixelNote();
  if (document.getElementById('p5')?.classList.contains('active')) {
    renderLayoutLivePreview();
  }
  if (document.getElementById('p6')?.classList.contains('active')) {
    renderPreview();
  }
};

const saveAndGen = async () => {
  console.log('🔘 Save & Generate clicked');
  const activeLines = state.lines.filter(line => line.text.trim());
  if (state.contentType === 'text' && !activeLines.length) {
    window.alert('Add at least one line of text.');
    return;
  }
  if (state.contentType === 'image' && !state.imageFile) {
    window.alert('Select an image file.');
    return;
  }
  if (state.contentType === 'url') {
    window.alert('Saving URLs is not supported. Please upload an image file or use text mode.');
    return;
  }
  const W = parseFloat(elements.sw?.value) || 6;
  const H = parseFloat(elements.sh?.value) || 1;
  if (!elements.overlay || !elements.ovText) {
    console.error('❌ Overlay elements not found');
    return;
  }
  
  console.log('Save request:', { W, H, contentType: state.contentType, pitch: state.selectedPitch?.code });
  elements.ovText.textContent = 'Saving to MongoDB...';
  elements.overlay.classList.add('show');
  console.log('Overlay shown, sending API request...');

  try {
    const payload = {
      widthFt: W,
      heightFt: H,
      pixelPitch: state.selectedPitch.mm,
      pitchCode: state.selectedPitch.code,
    };
    let endpoint = API;
    let method = state.currentSlug ? 'PUT' : 'POST';
    if (state.contentType === 'image') {
      payload.imageData = await fileToDataURL(state.imageFile);
      endpoint = state.currentSlug ? `${API}/${state.currentSlug}` : `${API}/image`;
    } else {
      payload.lines = activeLines.map(({ id, ...rest }) => rest);
      if (state.currentSlug) endpoint = `${API}/${state.currentSlug}`;
    }
    
    console.log('Fetching:', endpoint, 'with method:', method);
    const response = await fetch(endpoint, {
      method,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    console.log('Response status:', response.status);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Save failed');
    
    console.log('✅ Save successful, slug:', data.board.slug);
    state.currentSlug = data.board.slug;
    if (elements.urlShow) elements.urlShow.textContent = `${location.origin}/board/${state.currentSlug}`;
    if (elements.openLink) elements.openLink.href = `${location.origin}/board/${state.currentSlug}`;
    if (elements.resultBar) elements.resultBar.classList.add('show');
    elements.ovText.textContent = 'Saved!';
    setTimeout(() => elements.overlay.classList.remove('show'), 1000);
    setPill(true);
  } catch (error) {
    console.error('❌ Save error:', error);
    elements.overlay.classList.remove('show');
    window.alert(`Save failed: ${error.message}\n\nIs the server running? Check .env MONGO_URI.`);
    setPill(false);
  }
};

const buildContentHTML = () => {
  const activeLines = state.lines.filter(line => line.text.trim());
  const selected = state.selectedPitch;
  if (!selected) return '';
  const W = parseFloat(elements.sw?.value) || 6;
  const pm = selected.mm;
  const totalCols = Math.round((W * 304.8) / pm);
  
  if (state.contentType === 'text') {
    const content = activeLines.map(line => {
      const vw = (line.fontSize / totalCols) * 100;
      return `<div style="font-family:${line.fontFamily};font-size:clamp(10px,${vw}vw,${line.fontSize * 3}px);color:${line.color};font-weight:${line.bold ? 700 : 400};font-style:${line.italic ? 'italic' : 'normal'};text-decoration:${line.underline ? 'underline' : 'none'};text-align:center;letter-spacing:${line.letterSpacing}px;line-height:1.05;width:100%;display:block">${escapeHTML(line.text)}</div>`;
    }).join('');
    return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;overflow:hidden;"><div style="transform:translate(${layout.posX}px, ${layout.posY}px) scale(${layout.scaleX}, ${layout.scaleY});display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;">${content}</div></div>`;
  } else if ((state.contentType === 'image' || state.contentType === 'url') && state.imageBase64) {
    const H = parseFloat(elements.sh?.value) || 1;
    const totalRows = Math.round((H * 304.8) / pm);
    return `<canvas id="c" width="${totalCols}" height="${totalRows}" style="width:100%;height:100%;background:black;"></canvas><script>
      const canvas = document.getElementById("c");
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "black";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      const img = new Image();
      img.src = "${state.imageBase64.replace(/"/g, '\\"')}";
      img.onload = function() {
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
      };
    <\/script>`;
  }
  return '';
};

const escapeHTML = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const dlHTML = () => {
  console.log('🔘 Download HTML clicked');
  const W = parseFloat(elements.sw?.value) || 6;
  const H = parseFloat(elements.sh?.value) || 1;
  const selected = state.selectedPitch;
  
  console.log('Board dimensions:', { W, H, pitch: selected?.code });
  
  if (!selected) {
    console.error('❌ No pitch selected');
    window.alert('Select a pitch size first.');
    return;
  }
  
  const aspect = W / H;
  const contentHTML = buildContentHTML();
  
  console.log('Content HTML generated:', contentHTML.substring(0, 100) + '...');
  
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Board ${W}x${H}ft ${selected.code}</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Syne:wght@700;800&family=Oswald:wght@400;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:black;overflow:hidden}.b{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);aspect-ratio:${aspect};width:min(100vw,calc(100vh * ${aspect}));background:black;display:flex;flex-direction:column;align-items:stretch;justify-content:center;padding:0;gap:0}</style></head><body><div class="b">${contentHTML}</div></body></html>`;
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  link.download = `board_${W}x${H}ft_${selected.code}.html`;
  
  console.log('Triggering download:', link.download);
  link.click();
  console.log('✅ Download triggered');
};

const loadRecent = async () => {
  if (!elements.savedList) return;
  try {
    const response = await fetch(API);
    const data = await response.json();
    setPill(true);
    if (!data.boards || !data.boards.length) {
      elements.savedList.innerHTML = '<div class="empty">No boards yet — create your first!</div>';
      return;
    }
    elements.savedList.innerHTML = data.boards.slice(0, 5).map(board => `
      <a class="saved-row" href="/board/${board.slug}" target="_blank">
        <div>
          <div class="saved-slug">${board.slug}</div>
          <div class="saved-info">${board.widthFt}x${board.heightFt} ft | ${board.pitchCode || 'P10'} | ${((board.lines && board.lines.length) || 0)} lines | Views ${board.views}</div>
        </div>
        <div class="saved-date">${new Date(board.createdAt).toLocaleDateString()}</div>
      </a>
    `).join('');
  } catch {
    elements.savedList.innerHTML = '<div class="empty">Server offline</div>';
    setPill(false);
  }
};

const delBoard = async (slug, button) => {
  if (!window.confirm(`Delete board "${slug}"?`)) return;
  try {
    await fetch(`${API}/${slug}`, { method: 'DELETE' });
    button.closest('.board-row')?.remove();
  } catch {
    window.alert('Delete failed.');
  }
};

const handleBodyClick = (event) => {
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  console.log('🔘 Button clicked:', action);
  switch (action) {
    case 'start-new':
      startNew();
      break;
    case 'go':
      showPage(Number(actionTarget.dataset.page));
      break;
    case 'set-content-type':
      setContentType(actionTarget.dataset.contentType);
      break;
    case 'add-line':
      addLine();
      break;
    case 'go-to-style':
      goToStyle();
      break;
    case 'go-to-preview':
      goToPreview();
      break;
    case 'select-pitch':
      selectPitch(actionTarget.dataset.pitch, actionTarget.dataset.category);
      break;
    case 'set-size':
      if (elements.sw) elements.sw.value = actionTarget.dataset.width;
      if (elements.sh) elements.sh.value = actionTarget.dataset.height;
      updatePixelNote();
      livePreview();
      break;
    case 'fit-width':
      fitToWidth();
      break;
    case 'fit-height':
      fitToHeight();
      break;
    case 'fit-board':
      fitToBoard();
      break;
    case 'reset-layout':
      resetLayout();
      break;
    case 'download-html':
      dlHTML();
      break;
    case 'save-and-gen':
      saveAndGen();
      break;
    case 'copy-url':
      copyURL();
      break;
    case 'remove-line':
      removeLine(Number(actionTarget.dataset.lineId));
      break;
    case 'toggle-style':
      toggleLineStyle(Number(actionTarget.dataset.lineId), actionTarget.dataset.field);
      break;
    case 'set-align':
      updateLineProperty(Number(actionTarget.dataset.lineId), 'align', actionTarget.dataset.align);
      renderStyleBlocks();
      break;
    case 'set-color':
      updateLineProperty(Number(actionTarget.dataset.lineId), 'color', actionTarget.dataset.color);
      renderStyleBlocks();
      break;
    default:
      break;
  }
};

const handleLinesInput = (event) => {
  const input = event.target;
  if (!input.matches('.line-input')) return;
  const lineId = Number(input.dataset.lineId);
  updateLineProperty(lineId, 'text', input.value);
};

const handleStyleInput = (event) => {
  const input = event.target;
  if (!input.matches('.style-input')) return;
  const lineId = Number(input.dataset.lineId);
  const field = input.dataset.field;
  const value = input.type === 'number' ? Number(input.value) : input.value;
  updateLineProperty(lineId, field, value);
  renderStyleBlocks();
};

const init = () => {
  cacheElements();
  document.body.addEventListener('click', handleBodyClick);
  elements.linesList?.addEventListener('input', handleLinesInput);
  elements.styleBlocks?.addEventListener('input', handleStyleInput);
  elements.imageUpload?.addEventListener('change', handleImageChange);
  elements.imageUrl?.addEventListener('input', (event) => handleURLChange(event.target.value));
  elements.layoutControlsPanel?.addEventListener('input', handleLayoutInput);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && document.activeElement?.matches('#image-url')) {
      event.stopPropagation();
    }
  });
  window.addEventListener('resize', () => {
    if (document.getElementById('p5')?.classList.contains('active')) {
      renderLayoutLivePreview();
    }
    if (document.getElementById('p6')?.classList.contains('active')) {
      renderPreview();
    }
  });
  checkDB();
  loadRecent();
  buildPitchGrid();
  buildSizePresets();
  setContentType('text');
  state.lines = [createLine()];
  updateLayoutUI();
  renderLines();
  renderStyleBlocks();
};

document.addEventListener('DOMContentLoaded', init);
