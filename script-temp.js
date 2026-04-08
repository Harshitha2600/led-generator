
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PIXEL PITCH SPECS & LED CONFIG
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const LED_PRESETS = {
  indoor: {
    P4: { width: 80, height: 40, pitch: 4 },
    P3: { width: 64, height: 64, pitch: 3 },
    P2_5: { width: 128, height: 64, pitch: 2.5 },
    P2: { width: 160, height: 80, pitch: 2 },
    P1_5: { width: 174, height: 87, pitch: 1.5 }
  },
  outdoor: {
    P10: { width: 32, height: 16, pitch: 10 },
    P6: { width: 32, height: 32, pitch: 6 },
    P5: { width: 64, height: 32, pitch: 5 },
    P4: { width: 80, height: 40, pitch: 4 },
    P3: { width: 64, height: 64, pitch: 3 }
  }
};

// Legacy support - convert to new format
const PITCHES = [
  { code:'P10', mm:10, use:'Outdoor advertising' },
  { code:'P6',  mm:6,  use:'Outdoor / semi-outdoor' },
  { code:'P5',  mm:5,  use:'Outdoor medium-res' },
  { code:'P4',  mm:4,  use:'Outdoor / Indoor hybrid' },
  { code:'P3',  mm:3,  use:'Indoor professional' },
  { code:'P2.5', mm:2.5, use:'High-res indoor' },
  { code:'P2',  mm:2,  use:'Ultra high-res indoor' },
  { code:'P1.5', mm:1.5, use:'Premium high-res' },
];

const LED_CONFIG = {
  'P10': { moduleWidth: 32, moduleHeight: 16 },
  'P6': { moduleWidth: 32, moduleHeight: 32 },
  'P5': { moduleWidth: 64, moduleHeight: 32 },
  'P4': { moduleWidth: 80, moduleHeight: 40 },
  'P3': { moduleWidth: 64, moduleHeight: 64 },
  'P2.5': { moduleWidth: 128, moduleHeight: 64 },
  'P2': { moduleWidth: 160, moduleHeight: 80 },
  'P1.5': { moduleWidth: 174, moduleHeight: 87 }
};

function calculateSize(preset) {
  return {
    widthFt: (preset.width * preset.pitch) / 304.8,
    heightFt: (preset.height * preset.pitch) / 304.8
  };
}

function selectLEDPreset(category, presetKey) {
  const preset = LED_PRESETS[category][presetKey];
  if (!preset) return;
  
  const size = calculateSize(preset);
  
  // Update inputs
  document.getElementById('sw').value = size.widthFt.toFixed(1);
  document.getElementById('sh').value = size.heightFt.toFixed(1);
  
  // Update selected pitch for compatibility
  const pitchCode = presetKey.replace('_', '.');
  selectPitch(pitchCode);
  
  updatePixelNote();
  livePreview();
}

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

let lines = [];
let currentSlug = null;
let selectedPitch = PITCHES[0]; // default P10

// NEW: content type state
let contentType = "text";
let imageFile = null;
let imageURL = "";

// Optional: background and padding
let backgroundColor = 'transparent';
let padding = 0;

async function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   LED RESOLUTION & RENDERING
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function getLEDResolution(pitchCode) {
  return LED_CONFIG[pitchCode] || LED_CONFIG['P10'];
}

function renderToLEDGrid(source, ledWidth, ledHeight, isText, textLines) {
  return new Promise((resolve, reject) => {
    const ledBuffer = document.createElement('canvas');
    ledBuffer.width = ledWidth;
    ledBuffer.height = ledHeight;
    const ledCtx = ledBuffer.getContext('2d');
    ledCtx.imageSmoothingEnabled = true;
    ledCtx.imageSmoothingQuality = 'high';
    ledCtx.clearRect(0, 0, ledWidth, ledHeight);

    if (isText) {
      renderTextToLEDBuffer(ledCtx, ledBuffer, textLines);
      resolve(ledBuffer);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let objectUrl = null;

      img.onload = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        ledCtx.drawImage(img, 0, 0, ledWidth, ledHeight);
        resolve(ledBuffer);
      };

      img.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };

      if (typeof source === 'string') {
        img.src = source;
      } else {
        objectUrl = URL.createObjectURL(source);
        img.src = objectUrl;
      }
    }
  });
}

function renderTextToLEDBuffer(ctx, buffer, textLines) {
  const active = textLines.filter(l => l.text.trim());
  if (!active.length) return;

  const totalRows = buffer.height;
  const totalCols = buffer.width;
  const rowHeight = totalRows / active.length;

  active.forEach((line, idx) => {
    const y = (idx + 0.5) * rowHeight;
    const fontSize = Math.max(8, (line.fontSize / totalCols) * buffer.width * 0.8);

    ctx.font = `${line.bold ? 'bold' : 'normal'} ${fontSize}px ${line.fontFamily}`;
    ctx.fillStyle = line.color;
    ctx.textAlign = line.align;
    ctx.textBaseline = 'middle';

    const x = line.align === 'center' ? totalCols / 2 : line.align === 'right' ? totalCols - 4 : 4;
    ctx.fillText(line.text.substring(0, 20), x, y);
  });
}

function drawLEDFromBuffer(ctx, mainCanvas, ledBuffer, ledWidth, ledHeight) {
  // Fill with solid black background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
  
  // Get LED buffer pixel data
  const imageData = ledBuffer.getContext('2d').getImageData(0, 0, ledWidth, ledHeight);
  const data = imageData.data;
  
  // Calculate scaling factors
  const scaleX = mainCanvas.width / ledWidth;
  const scaleY = mainCanvas.height / ledHeight;
  
  // Render LEDs - skip dark pixels
  for (let row = 0; row < ledHeight; row++) {
    for (let col = 0; col < ledWidth; col++) {
      const idx = (row * ledWidth + col) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3] / 255;
      
      // Skip dark pixels completely
      if (a === 0 || (r < 30 && g < 30 && b < 30)) {
        continue;
      }
      
      // Draw LED dot
      const x = col * scaleX + scaleX / 2;
      const y = row * scaleY + scaleY / 2;
      const radius = Math.min(scaleX, scaleY) * 0.4;
      
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   INIT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
window.onload = () => {
  checkDB();
  loadRecent();
  buildPitchGrid();
  setContentType('text'); // Initialize UI
};

function buildPitchGrid() {
  const grid = document.getElementById('pitch-grid');
  grid.innerHTML = PITCHES.map(p => `
    <button class="pitch-btn${p.code===selectedPitch.code?' sel':''}" onclick="selectPitch('${p.code}')" id="pb-${p.code.replace('.','_')}">
      <span class="pitch-code">${p.code}</span>
      <span class="pitch-mm">${p.mm} mm/pixel</span>
      <span class="pitch-use">${p.use}</span>
    </button>`).join('');
  updatePixelNote();
}

function selectPitch(code) {
  selectedPitch = PITCHES.find(p => p.code === code);
  document.querySelectorAll('.pitch-btn').forEach(b => b.classList.remove('sel'));
  const btn = document.getElementById('pb-' + code.replace('.','_'));
  if (btn) btn.classList.add('sel');
  updatePixelNote();
  livePreview();
}

function updatePixelNote() {
  const swEl = document.getElementById('sw');
  const shEl = document.getElementById('sh');
  const W = parseFloat(swEl ? swEl.value : '') || 6;
  const H = parseFloat(shEl ? shEl.value : '') || 1;
  if (!selectedPitch) return;
  
  // Get LED resolution from preset
  const ledConfig = LED_CONFIG[selectedPitch.code];
  if (!ledConfig) return;
  
  const cols = ledConfig.moduleWidth;
  const rows = ledConfig.moduleHeight;
  
  const note = document.getElementById('pixel-count-note');
  if (note) note.textContent = `ðŸ“ ${W}Ã—${H} ft with ${selectedPitch.code} = ${cols} Ã— ${rows} LED pixels (${(cols*rows).toLocaleString()} total)`;
}

function handleImageChange(event) {
  const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
  imageFile = null;
  document.getElementById('image-name').textContent = '';
  document.getElementById('image-preview').textContent = 'No image selected.';
  if (!file) return;
  if (!file.type.startsWith('image/') || (!file.type.includes('png') && !file.type.includes('jpg') && !file.type.includes('jpeg'))) {
    alert('Only PNG or JPG images are allowed.');
    return;
  }
  imageFile = file;
  document.getElementById('image-name').textContent = file.name;
  document.getElementById('image-preview').textContent = 'Image selected â€” preview available in the board preview step.';
  livePreview();
}

function setContentType(type) {
  contentType = type;
  // Update button active states
  document.getElementById('btn-text').classList.toggle('active', type === 'text');
  document.getElementById('btn-image').classList.toggle('active', type === 'image');
  document.getElementById('btn-url').classList.toggle('active', type === 'url');
  // Hide/show inputs based on type
  document.getElementById('text-inputs').style.display = type === 'text' ? 'block' : 'none';
  document.getElementById('image-inputs').style.display = type === 'image' ? 'block' : 'none';
  document.getElementById('url-inputs').style.display = type === 'url' ? 'block' : 'none';
  livePreview();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   DB + NAV
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function checkDB() {
  try { await fetch(API); setPill(true); } catch(e) { setPill(false); }
}
function setPill(ok) {
  const p = document.getElementById('db-pill');
  p.className = 'db-pill ' + (ok ? 'ok' : 'err');
  document.getElementById('db-label').textContent = ok ? 'MongoDB âœ“' : 'DB offline';
}

function go(n) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('p' + n).classList.add('active');
  if (n === 1) loadRecent();
  if (n === 5) renderPreview();
  if (n === 6) loadAllBoards();
}

function startNew() {
  lines = []; currentSlug = null;
  contentType = 'text';
  imageFile = null;
  imageURL = '';
  const imageNameEl = document.getElementById('image-name');
  if (imageNameEl) imageNameEl.textContent = '';
  const imagePreviewEl = document.getElementById('image-preview');
  if (imagePreviewEl) imagePreviewEl.textContent = 'No image selected.';
  setContentType('text');
  addLine(); go(2); renderLines();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   LINES
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function addLine() {
  lines.push({ id: Date.now()+Math.random(), text:'', fontSize:80, fontFamily:FONTS[0].v, color:'#ffffff', bold:false, italic:false, underline:false, align:'center', letterSpacing:0 });
  renderLines();
}
function removeLine(id) {
  if (lines.length <= 1) return;
  lines = lines.filter(l => l.id !== id);
  renderLines(); renderStyleBlocks();
}
function ul(id, k, v) { const l=lines.find(l=>l.id===id); if(l){l[k]=v;livePreview();} }
function tl(id, k)    { const l=lines.find(l=>l.id===id); if(l){l[k]=!l[k];renderStyleBlocks();livePreview();} }

function renderLines() {
  const wrap = document.getElementById('lines-list');
  wrap.innerHTML = '';
  lines.forEach((l, i) => {
    const d = document.createElement('div');
    d.className = 'line-card';
    d.innerHTML = `
      <div class="line-num">${i+1}</div>
      <textarea class="line-input" rows="2" placeholder="Line ${i+1} text..."
        oninput="ul(${l.id},'text',this.value);renderStyleBlocks()">${l.text}</textarea>
      ${lines.length>1?`<button class="line-del" onclick="removeLine(${l.id})" title="Remove">âœ•</button>`:''}
    `;
    wrap.appendChild(d);
  });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   STYLE BLOCKS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function goToStyle() {
  if (contentType !== 'text') {
    go(4);
    return;
  }
  if (!lines.some(l=>l.text.trim())) { alert('Please enter text in at least one line first.'); return; }
  renderStyleBlocks(); go(3);
}

function renderStyleBlocks() {
  const wrap = document.getElementById('style-blocks');
  wrap.innerHTML = '';
  lines.filter(l=>l.text.trim()).forEach((l, i) => {
    const d = document.createElement('div');
    d.className = 'sblock';
    d.innerHTML = `
      <div class="sblock-head">
        <div class="sblock-num">${i+1}</div>
        <div class="sblock-text">"${l.text.substring(0,40)}${l.text.length>40?'â€¦':''}"</div>
      </div>
      <div class="sblock-body">
        <div class="ctrl-row">
          <div class="ctrl">
            <div class="ctrl-label">Font Size (LED px)</div>
            <input type="number" class="cinput" value="${l.fontSize}" min="10" max="800" step="2"
              oninput="ul(${l.id},'fontSize',+this.value)">
          </div>
          <div class="ctrl">
            <div class="ctrl-label">Letter Spacing (px)</div>
            <input type="number" class="cinput" value="${l.letterSpacing}" min="-5" max="80" step="1"
              oninput="ul(${l.id},'letterSpacing',+this.value)">
          </div>
        </div>
        <div class="ctrl">
          <div class="ctrl-label">Font Family</div>
          <select class="cselect" onchange="ul(${l.id},'fontFamily',this.value)">
            ${FONTS.map(f=>`<option value="${f.v}" ${l.fontFamily===f.v?'selected':''}>${f.n}</option>`).join('')}
          </select>
        </div>
        <div class="ctrl">
          <div class="ctrl-label">Text Color</div>
          <div class="color-row">
            <input type="color" class="cswatch" value="${l.color}"
              oninput="ul(${l.id},'color',this.value)" id="csw-${l.id}">
            <div class="cprow">
              ${TEXT_COLORS.map(c=>`<div class="cp" style="background:${c};border:2px solid #444" title="${c}"
                onclick="ul(${l.id},'color','${c}');document.getElementById('csw-${l.id}').value='${c}'"></div>`).join('')}
            </div>
          </div>
        </div>
        <div class="ctrl">
          <div class="ctrl-label">Style</div>
          <div class="togs">
            <button class="tog${l.bold?' on':''}" onclick="tl(${l.id},'bold')"><strong>B</strong></button>
            <button class="tog${l.italic?' on':''}" onclick="tl(${l.id},'italic')"><em>I</em></button>
            <button class="tog${l.underline?' on':''}" onclick="tl(${l.id},'underline')"><u>U</u></button>
          </div>
        </div>
        <div class="ctrl">
          <div class="ctrl-label">Alignment</div>
          <div class="aligns">
            <button class="aln${l.align==='left'?' on':''}" onclick="ul(${l.id},'align','left');renderStyleBlocks()">â—€ Left</button>
            <button class="aln${l.align==='center'?' on':''}" onclick="ul(${l.id},'align','center');renderStyleBlocks()">â–  Center</button>
            <button class="aln${l.align==='right'?' on':''}" onclick="ul(${l.id},'align','right');renderStyleBlocks()">Right â–¶</button>
          </div>
        </div>
      </div>`;
    wrap.appendChild(d);
  });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SIZE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function setSize(w, h) {
  document.getElementById('sw').value = w;
  document.getElementById('sh').value = h;
  updatePixelNote(); livePreview();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PREVIEW â€” pixel-pitch aware
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function goToPreview() { renderPreview(); go(5); }

function renderPreview() {
  const W  = parseFloat(document.getElementById('sw').value) || 6;
  const H  = parseFloat(document.getElementById('sh').value) || 1;
  const pc = selectedPitch ? selectedPitch.code : 'P10';
  
  // Get LED resolution from preset
  const ledConfig = LED_CONFIG[pc];
  if (!ledConfig) return;
  
  const ledWidth = ledConfig.moduleWidth;
  const ledHeight = ledConfig.moduleHeight;
  
  document.getElementById('size-tag').textContent  = `${W} Ã— ${H} ft`;
  document.getElementById('pitch-tag').textContent = pc;
  document.getElementById('pixel-info').textContent = `${ledWidth} Ã— ${ledHeight} LED px`;

  const stage  = document.getElementById('stage');
  const wrap   = document.getElementById('board-wrap');
  const canvas = document.getElementById('board-canvas');
  const aspect = W / H;

  // Set canvas to display size (not LED resolution)
  canvas.width = 800;
  canvas.height = 600;
  
  // Scale display in wrapper to fit screen while maintaining aspect ratio
  const stageW = stage.clientWidth  || window.innerWidth;
  const stageH = stage.clientHeight || (window.innerHeight - 160);
  let cw, ch;
  if (stageW / stageH > aspect) { ch = stageH; cw = ch * aspect; }
  else                           { cw = stageW; ch = cw / aspect; }

  wrap.style.width = `${cw}px`;
  wrap.style.height = `${ch}px`;
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Optional: background
  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // NEW: branch based on contentType
  if (contentType === 'image') {
    if (!imageFile) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '1rem sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Select an image...', canvas.width / 2, canvas.height / 2);
      return;
    }
    renderImagePreview(canvas, ctx, imageFile, ledWidth, ledHeight);
    return;
  }

  if (contentType === 'url') {
    if (!imageURL.trim()) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '1rem sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Enter image URL...', canvas.width / 2, canvas.height / 2);
      return;
    }
    renderImagePreview(canvas, ctx, imageURL, ledWidth, ledHeight);
    return;
  }

  // Text rendering
  renderTextPreview(canvas, ctx, ledWidth, ledHeight);
}

function renderImagePreview(canvas, ctx, source, ledWidth, ledHeight) {
  renderToLEDGrid(source, ledWidth, ledHeight, false)
    .then(ledBuffer => {
      drawLEDFromBuffer(ctx, canvas, ledBuffer, ledWidth, ledHeight);
    })
    .catch(err => {
      ctx.fillStyle = 'red';
      ctx.font = '1rem sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Error: ' + err.message, canvas.width / 2, canvas.height / 2);
    });
}

function renderTextPreview(canvas, ctx, ledWidth, ledHeight) {
  const active = lines.filter(l => l.text.trim());
  if (!active.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '1rem sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Add text lines...', canvas.width / 2, canvas.height / 2);
    return;
  }

  renderToLEDGrid(null, ledWidth, ledHeight, true, active)
    .then(ledBuffer => {
      drawLEDFromBuffer(ctx, canvas, ledBuffer, ledWidth, ledHeight);
    })
    .catch(err => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
}

function livePreview() {
  updatePixelNote();
  if (document.getElementById('p5').classList.contains('active')) renderPreview();
}
window.addEventListener('resize', () => {
  if (document.getElementById('p5').classList.contains('active')) renderPreview();
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SAVE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function saveAndGen() {
  let active = [];
  if (contentType === 'text') {
    active = lines.filter(l => l.text.trim());
    if (!active.length) { alert('Add at least one line of text.'); return; }
  } else if (contentType === 'image') {
    if (!imageFile) { alert('Select an image file.'); return; }
  } else if (contentType === 'url') {
    alert('Saving URLs is not supported. Please upload an image file or use text mode.');
    return;
  }

  const W  = parseFloat(document.getElementById('sw').value) || 6;
  const H  = parseFloat(document.getElementById('sh').value) || 1;
  document.getElementById('ov-text').textContent = 'Saving to MongoDB...';
  document.getElementById('overlay').classList.add('show');

  try {
    const payload = {
      widthFt: W,
      heightFt: H,
      pixelPitch: selectedPitch.mm,
      pitchCode:  selectedPitch.code,
    };

    let endpoint = API;
    let method = currentSlug ? 'PUT' : 'POST';

    if (contentType === 'image') {
      payload.imageData = await fileToDataURL(imageFile);
      if (currentSlug) {
        endpoint = `${API}/${currentSlug}`;
      } else {
        endpoint = `${API}/image`;
      }
    } else {
      payload.lines = active.map(({ id, ...rest }) => rest);
      if (currentSlug) endpoint = `${API}/${currentSlug}`;
    }

    const res = await fetch(endpoint, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');

    currentSlug = data.board.slug;
    const url = `${location.origin}/board/${currentSlug}`;
    document.getElementById('url-show').textContent = url;
    document.getElementById('open-link').href = url;
    document.getElementById('result-bar').classList.add('show');
    document.getElementById('ov-text').textContent = 'âœ… Saved!';
    setTimeout(() => document.getElementById('overlay').classList.remove('show'), 1000);
    setPill(true);
  } catch(err) {
    document.getElementById('overlay').classList.remove('show');
    alert('âŒ Save failed: ' + err.message + '\n\nIs the server running? Check .env MONGO_URI.');
    setPill(false);
  }
}

function copyURL() {
  const url = document.getElementById('url-show').textContent;
  navigator.clipboard.writeText(url).then(() => {
    const b = document.getElementById('copy-btn');
    b.textContent = 'âœ“ Copied!'; b.classList.add('ok');
    setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('ok'); }, 2000);
  });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   DOWNLOAD HTML
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function dlHTML() {
  const W = parseFloat(document.getElementById('sw').value) || 6;
  const H = parseFloat(document.getElementById('sh').value) || 1;
  const pm = selectedPitch.mm;
  const totalCols = Math.round((W * 304.8) / pm);
  const active = lines.filter(l => l.text.trim());
  const aspect = W / H;
  const lHTML = active.map(l => {
    const vw = (l.fontSize / totalCols) * 100;
    return `<div style="font-family:${l.fontFamily};font-size:clamp(10px,${vw}vw,${l.fontSize*3}px);color:${l.color};font-weight:${l.bold?700:400};font-style:${l.italic?'italic':'normal'};text-decoration:${l.underline?'underline':'none'};text-align:${l.align};letter-spacing:${l.letterSpacing}px;line-height:1.05;width:100%;display:block">${l.text}</div>`;
  }).join('');
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Board ${W}x${H}ft ${selectedPitch.code}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Syne:wght@700;800&family=Oswald:wght@400;700&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden}
.b{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);aspect-ratio:${aspect};width:min(100vw,calc(100vh * ${aspect}));background:transparent;display:flex;flex-direction:column;align-items:stretch;justify-content:center;padding:0;gap:0}
</style></head><body><div class="b">${lHTML}</div></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], {type:'text/html'}));
  a.download = `board_${W}x${H}ft_${selectedPitch.code}.html`;
  a.click();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   LOAD RECENT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function loadRecent() {
  const list = document.getElementById('saved-list');
  try {
    const r = await fetch(API); const d = await r.json();
    setPill(true);
    if (!d.boards || !d.boards.length) { list.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:14px;text-align:center">No boards yet â€” create your first!</div>'; return; }
    list.innerHTML = d.boards.slice(0,5).map(b => `
      <a class="saved-row" href="/board/${b.slug}" target="_blank">
        <div>
          <div class="saved-slug">${b.slug}</div>
          <div class="saved-info">${b.widthFt}Ã—${b.heightFt} ft Â· ${b.pitchCode||'P10'} Â· ${((b.lines && b.lines.length) || 0)} lines Â· ðŸ‘ ${b.views}</div>
        </div>
        <div class="saved-date">${new Date(b.createdAt).toLocaleDateString()}</div>
      </a>`).join('');
  } catch(e) {
    list.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:14px;text-align:center">Server offline</div>';
    setPill(false);
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ALL BOARDS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function loadAllBoards() {
  const wrap = document.getElementById('boards-list');
  wrap.innerHTML = '<div class="empty">Loading...</div>';
  try {
    const r = await fetch(API); const d = await r.json();
    if (!d.boards || !d.boards.length) { wrap.innerHTML = '<div class="empty">No boards saved yet.</div>'; return; }
    wrap.innerHTML = d.boards.map(b => `
      <div class="board-row">
        <div>
          <div class="br-slug">/${b.slug}</div>
          <div class="br-meta">${b.widthFt}Ã—${b.heightFt} ft Â· ${b.pitchCode||'P10'} Â· ${((b.lines && b.lines.length) || 0)} lines Â· ðŸ‘ ${b.views}</div>
        </div>
        <div class="br-date">${new Date(b.createdAt).toLocaleString()}</div>
        <div class="br-btns">
          <a class="brbtn" href="/board/${b.slug}" target="_blank">â†— Open</a>
          <button class="brbtn del" onclick="delBoard('${b.slug}',this)">ðŸ—‘ Delete</button>
        </div>
      </div>`).join('');
  } catch(e) { wrap.innerHTML = '<div class="empty">Failed to load. Is server running?</div>'; }
}

async function delBoard(slug, btn) {
  if (!confirm(`Delete board "${slug}"?`)) return;
  try { await fetch(`${API}/${slug}`, {method:'DELETE'}); btn.closest('.board-row').remove(); }
  catch(e) { alert('Delete failed.'); }
}

