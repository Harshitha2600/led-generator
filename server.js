require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
let Board;

try {
  Board = require('./models/Board');
} catch (_err) {
  Board = null;
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const LIVE_BOARDS_PATH = path.join(__dirname, 'live-boards.json');
const DEFAULT_BOARD_ID = 'default';
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const activeSockets = new Set();
let mongoBoardsEnabled = false;

// --- 1. STRICT ANTI-CACHING MIDDLEWARE ---
// Forces Render, Netlify, and Android LED browsers to ALWAYS fetch fresh data.
const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store'); // Disables CDN edge caching
  next();
};

const DEFAULT_BOARD = {
  id: DEFAULT_BOARD_ID,
  lines: [
    {
      text: 'WELCOME TO YOUR LED BOARD',
      fontSize: 80,
      fontFamily: "'Oswald',sans-serif",
      color: '#39ff88',
      bold: true,
      italic: false,
      underline: false,
      align: 'center',
      letterSpacing: 2,
    },
  ],
  widthFt: 6,
  heightFt: 1,
  pixelPitch: 10,
  pitchCode: 'P10',
  ledOn: '#39ff88',
  ledOff: '#04110b',
  background: '#000000',
  animation: 'scroll',
  animationSpeed: 4,
  updatedAt: new Date().toISOString(),
};

function slugifyId(value) {
  const cleaned = String(value || DEFAULT_BOARD_ID)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || DEFAULT_BOARD_ID;
}

function normalizeHex(color, fallback) {
  const value = String(color || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

function clamp(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeLine(line = {}) {
  return {
    text: String(line.text || '').slice(0, 200),
    fontSize: Math.round(clamp(line.fontSize, 12, 200, 80)),
    fontFamily: String(line.fontFamily || "'DM Sans',sans-serif").slice(0, 120),
    color: normalizeHex(line.color, '#ffffff'),
    bold: Boolean(line.bold),
    italic: Boolean(line.italic),
    underline: Boolean(line.underline),
    align: ['left', 'center', 'right'].includes(String(line.align)) ? String(line.align) : 'center',
    letterSpacing: clamp(line.letterSpacing, -5, 40, 0),
  };
}

function sanitizeBoard(input = {}, boardId = DEFAULT_BOARD_ID) {
  const rawLines = Array.isArray(input.lines) ? input.lines : [];
  const lines = rawLines
    .map(sanitizeLine)
    .filter((line) => line.text.trim().length > 0)
    .slice(0, 6);

  return {
    id: slugifyId(boardId),
    lines: lines.length ? lines : DEFAULT_BOARD.lines,
    widthFt: clamp(input.widthFt, 1, 40, DEFAULT_BOARD.widthFt),
    heightFt: clamp(input.heightFt, 0.5, 20, DEFAULT_BOARD.heightFt),
    pixelPitch: clamp(input.pixelPitch, 2, 20, DEFAULT_BOARD.pixelPitch),
    pitchCode: String(input.pitchCode || DEFAULT_BOARD.pitchCode).slice(0, 20),
    ledOn: normalizeHex(input.ledOn, DEFAULT_BOARD.ledOn),
    ledOff: normalizeHex(input.ledOff, DEFAULT_BOARD.ledOff),
    background: normalizeHex(input.background, DEFAULT_BOARD.background),
    animation: ['scroll', 'static', 'blink', 'fade'].includes(String(input.animation || '').toLowerCase())
      ? String(input.animation).toLowerCase()
      : DEFAULT_BOARD.animation,
    animationSpeed: Math.round(clamp(input.animationSpeed, 1, 8, DEFAULT_BOARD.animationSpeed)),
    updatedAt: new Date().toISOString(),
  };
}

function ensureLiveBoardsFile() {
  if (!fs.existsSync(LIVE_BOARDS_PATH)) {
    const initial = { [DEFAULT_BOARD_ID]: DEFAULT_BOARD };
    fs.writeFileSync(LIVE_BOARDS_PATH, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

function readLiveBoards() {
  ensureLiveBoardsFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(LIVE_BOARDS_PATH, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid live board store');
    }
    return parsed;
  } catch (_err) {
    return { [DEFAULT_BOARD_ID]: DEFAULT_BOARD };
  }
}

function writeLiveBoards(boards) {
  fs.writeFileSync(LIVE_BOARDS_PATH, JSON.stringify(boards, null, 2), 'utf-8');
}

function getLiveBoard(boardId = DEFAULT_BOARD_ID) {
  const id = slugifyId(boardId);
  const boards = readLiveBoards();
  const board = boards[id] || (id === DEFAULT_BOARD_ID ? DEFAULT_BOARD : null);
  return board ? sanitizeBoard(board, id) : null;
}

function saveLiveBoard(boardId, payload) {
  const id = slugifyId(boardId);
  const boards = readLiveBoards();
  const existing = boards[id] || (id === DEFAULT_BOARD_ID ? DEFAULT_BOARD : {});
  const board = sanitizeBoard({ ...existing, ...payload }, id);
  boards[id] = board;
  writeLiveBoards(boards);
  return board;
}

function createWebSocketFrame(payload) {
  const message = Buffer.from(payload);
  const length = message.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), message]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, message]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, message]);
}

function sendSocketMessage(socket, payload) {
  if (socket.destroyed || !socket.writable) return;
  socket.write(createWebSocketFrame(JSON.stringify(payload)));
}

function broadcastBoardUpdate(board) {
  const payload = { type: 'board:update', board };
  for (const socket of activeSockets) {
    sendSocketMessage(socket, payload);
  }
}

function buildDisplayPage() {
  return fs.readFileSync(path.join(PUBLIC_DIR, 'display.html'), 'utf-8');
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildLegacyBoardPage(board) {
  const safeLines = JSON.stringify(board.lines || []).replace(/</g, '\\u003c');
  const widthFt = Number(board.widthFt) || 6;
  const heightFt = Number(board.heightFt) || 1;
  const pitch = Number(board.pixelPitch) || 10;
  const title = escapeHTML(board.lines?.[0]?.text || board.slug || 'Saved Board');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Syne:wght@700;800&family=Oswald:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { width: 100vw; height: 100vh; display: block; background: #000; }
  </style>
</head>
<body>
  <canvas id="board"></canvas>
  <script>
    const board = {
      widthFt: ${widthFt},
      heightFt: ${heightFt},
      pixelPitch: ${pitch},
      lines: ${safeLines}
    };
    const canvas = document.getElementById('board');
    const ctx = canvas.getContext('2d', { alpha: false });
    const source = document.createElement('canvas');
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    }

    function measureSpacedText(text, spacing) {
      const base = sourceCtx.measureText(text).width;
      if (!text || text.length <= 1) return base;
      return base + (text.length - 1) * spacing;
    }

    function drawSpacedText(text, x, y, spacing, align) {
      if (!spacing || text.length <= 1) {
        sourceCtx.fillText(text, x, y);
        return;
      }
      const totalWidth = measureSpacedText(text, spacing);
      let cursor = x;
      if (align === 'center') cursor -= totalWidth / 2;
      if (align === 'right') cursor -= totalWidth;
      for (const char of text) {
        sourceCtx.fillText(char, cursor, y);
        cursor += sourceCtx.measureText(char).width + spacing;
      }
    }

    function render() {
      const cols = Math.max(24, Math.round((board.widthFt * 304.8) / board.pixelPitch));
      const rows = Math.max(12, Math.round((board.heightFt * 304.8) / board.pixelPitch));
      source.width = cols;
      source.height = rows;
      sourceCtx.fillStyle = '#000';
      sourceCtx.fillRect(0, 0, cols, rows);

      const lines = board.lines.filter((line) => String(line.text || '').trim());
      const rowHeight = rows / Math.max(1, lines.length);
      lines.forEach((line, index) => {
        let fontSize = Math.max(10, Math.min(Number(line.fontSize) || 80, rowHeight * 1.05));
        sourceCtx.font = \`\${line.bold ? 'bold ' : ''}\${line.italic ? 'italic ' : ''}\${fontSize}px \${line.fontFamily || 'Arial, sans-serif'}\`.trim();
        const maxWidth = cols * 0.94;
        const measured = measureSpacedText(String(line.text || ''), Number(line.letterSpacing) || 0);
        if (measured > maxWidth) fontSize *= maxWidth / measured;
        sourceCtx.font = \`\${line.bold ? 'bold ' : ''}\${line.italic ? 'italic ' : ''}\${fontSize}px \${line.fontFamily || 'Arial, sans-serif'}\`.trim();
        sourceCtx.fillStyle = line.color || '#39ff88';
        sourceCtx.textBaseline = 'middle';
        sourceCtx.textAlign = line.align || 'center';
        const y = (index + 0.5) * rowHeight;
        const x = line.align === 'left' ? cols * 0.04 : line.align === 'right' ? cols * 0.96 : cols * 0.5;
        drawSpacedText(String(line.text || ''), x, y, Number(line.letterSpacing) || 0, line.align || 'center');
      });

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.drawImage(source, 0, 0, canvas.clientWidth, canvas.clientHeight);
    }

    window.addEventListener('resize', resize);
    resize();
  </script>
</body>
</html>`;
}

ensureLiveBoardsFile();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// --- 2. STATIC FILES CACHE BUSTING ---
// Serve public folder, but explicitly disable ETags and caching
app.use(express.static(PUBLIC_DIR, {
  etag: false,
  lastModified: false,
  maxAge: 0 
}));

// --- ROUTES ---
// We inject 'noCache' into every route that handles HTML or JSON data
app.get('/health/live', noCache, (_req, res) => {
  res.json({
    ok: true,
    defaultDisplay: '/display',
    dataApi: '/data',
    updateApi: '/update',
    mongoBoardsEnabled,
  });
});

app.get('/api/boards', noCache, (_req, res, next) => {
  if (mongoBoardsEnabled) {
    next();
    return;
  }
  res.json({ success: true, boards: [] });
});

app.get('/data', noCache, (_req, res) => {
  res.json(getLiveBoard(DEFAULT_BOARD_ID));
});

app.get('/data/:id', noCache, (req, res) => {
  const board = getLiveBoard(req.params.id);
  if (!board) {
    res.status(404).json({ error: 'Display board not found.' });
    return;
  }
  res.json(board);
});

app.post('/update', noCache, (req, res) => {
  const board = saveLiveBoard(DEFAULT_BOARD_ID, req.body || {});
  broadcastBoardUpdate(board);
  res.json({ success: true, id: board.id, displayUrl: '/display', board });
});

app.post('/update/:id', noCache, (req, res) => {
  const board = saveLiveBoard(req.params.id, req.body || {});
  broadcastBoardUpdate(board);
  res.json({ success: true, id: board.id, displayUrl: `/display/${board.id}`, board });
});

app.get('/display', noCache, (_req, res) => {
  res.type('html').send(buildDisplayPage());
});

app.get('/display/:id', noCache, (_req, res) => {
  res.type('html').send(buildDisplayPage());
});

app.get('/board/:slug', noCache, async (req, res) => {
  if (!mongoBoardsEnabled || !Board) {
    res.status(404).send('Saved board history is unavailable.');
    return;
  }

  try {
    const board = await Board.findOne({ slug: req.params.slug });
    if (!board) {
      res.status(404).send('Board not found.');
      return;
    }
    board.views += 1;
    await board.save();
    res.type('html').send(buildLegacyBoardPage(board));
  } catch (err) {
    res.status(500).send(`Error loading board: ${escapeHTML(err.message)}`);
  }
});

// Wildcard catch-all for the editor homepage
app.get('*', noCache, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- WEBSOCKET LOGIC (Untouched) ---
server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto.createHash('sha1').update(`${key}${WS_MAGIC}`).digest('base64');
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '\r\n',
  ];

  socket.write(headers.join('\r\n'));
  activeSockets.add(socket);

  sendSocketMessage(socket, { type: 'connected' });

  socket.on('close', () => activeSockets.delete(socket));
  socket.on('end', () => activeSockets.delete(socket));
  socket.on('error', () => activeSockets.delete(socket));
  socket.on('data', (buffer) => {
    if (!buffer || buffer.length < 2) return;
    const opcode = buffer[0] & 0x0f;
    if (opcode === 0x8) {
      activeSockets.delete(socket);
      socket.end();
    }
  });
});

async function start() {
  if (process.env.MONGO_URI && Board) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      app.use('/api/boards', require('./routes/boards'));
      mongoBoardsEnabled = true;
      console.log('MongoDB connected');
    } catch (err) {
      console.warn(`MongoDB unavailable: ${err.message}`);
    }
  } else {
    console.log('MongoDB skipped for permanent display mode');
  }

  server.listen(PORT, () => {
    console.log(`LED server running on http://localhost:${PORT}`);
    console.log('Editor URL            : /');
    console.log('Permanent display URL : /display');
    console.log('Data API              : /data');
    console.log('Update API            : /update');
    console.log('WebSocket             : /ws');
  });
}

start();