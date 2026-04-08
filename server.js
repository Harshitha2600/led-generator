require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const Board    = require('./models/Board');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/boards', require('./routes/boards'));

app.get('/board/:slug', async (req, res) => {
  try {
    const board = await Board.findOne({ slug: req.params.slug });
    if (!board) return res.status(404).send(notFoundPage(req.params.slug));
    board.views++;
    await board.save();
    res.send(buildDisplayPage(board, req));
  } catch (err) { res.status(500).send('Error: ' + err.message); }
});

function escapeHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function notFoundPage(slug) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Not Found</title>
<style>body{margin:0;background:#0c0c0c;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px}h2{color:#ff3d3d}a{color:#00c3ff;text-decoration:none}</style>
</head><body><h2>Board Not Found</h2><p style="color:#888">Slug: <code style="color:#00c3ff">${escapeHTML(slug)}</code></p><a href="/">← Create New Board</a></body></html>`;
}

function buildDisplayPage(board, req) {
  const aspect    = board.widthFt / board.heightFt;
  const pitchMm   = board.pixelPitch || 10;
  const pitchCode = board.pitchCode  || 'P10';
  const totalCols = Math.round((board.widthFt * 304.8) / pitchMm);
  const totalRows = Math.round((board.heightFt * 304.8) / pitchMm);
  const firstLine = escapeHTML(board.lines[0]?.text || 'Board');
  const slug      = board.slug;
  const origin    = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const boardURL  = `${origin}/board/${slug}`;
  const createdStr = new Date(board.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});

  const linesHTML = board.lines.map(l => {
    const vwSize = (l.fontSize / totalCols) * 100;
    return `<div style="font-family:${escapeHTML(l.fontFamily)};font-size:clamp(10px,${vwSize}vw,${l.fontSize*3}px);color:${escapeHTML(l.color)};font-weight:${l.bold?700:400};font-style:${l.italic?'italic':'normal'};text-decoration:${l.underline?'underline':'none'};text-align:${l.align};letter-spacing:${l.letterSpacing}px;line-height:1.05;width:100%;display:block;text-shadow:0 0 40px currentColor">${escapeHTML(l.text)}</div>`;
  }).join('\n');

  const boardContent = board.imageData ? `<canvas class="board-canvas" id="display-canvas"></canvas>` : linesHTML;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta property="og:title" content="${firstLine} — LED Board">
  <title>${firstLine} — LED Board</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Syne:wght@700;800&family=Oswald:wght@400;700&family=DM+Mono&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:#000;color:#fff;overflow:hidden;font-family:'DM Sans',sans-serif}
    body{display:flex;align-items:center;justify-content:center}
    .board-wrap{display:flex;align-items:center;justify-content:center;width:min(100%,calc((100vh - 100px) * ${aspect}));height:min(100%,calc(100vw / ${aspect}));max-width:100%;max-height:100%;aspect-ratio:${aspect};background:transparent;position:relative}
    .board-canvas{width:100%;height:100%;display:block;background:transparent}
    .board-content{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0}
    .board-line{width:100%}
  </style>
</head>
<body>

<div class="board-wrap" id="board-wrap">
${boardContent}
</div>
<script>
  const totalCols = ${totalCols};
  const totalRows = ${totalRows};
  const boardImage = ${board.imageData ? JSON.stringify(board.imageData) : 'null'};

  function renderImageBoard() {
    const canvas = document.getElementById('display-canvas');
    if (!canvas || !boardImage) return;

    /* Set canvas to actual LED resolution */
    canvas.width = totalCols;
    canvas.height = totalRows;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '16px sans-serif';
      ctx.fillText('Image failed to load', canvas.width / 2, canvas.height / 2);
    };
    img.src = boardImage;
  }

  window.addEventListener('resize', () => requestAnimationFrame(renderImageBoard));
  window.addEventListener('load', renderImageBoard);
</script>
</body>
</html>`;
}

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });
