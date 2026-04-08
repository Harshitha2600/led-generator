const express = require('express');
const router  = express.Router();
const Board   = require('../models/Board');

/* ── slug generator ── */
function slug(len = 8) {
  return Array.from({ length: len }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  ).join('');
}

/* ── HTML builder — uses pixel pitch for accurate font scaling ── */
function buildHTML(board) {
  const aspect     = board.widthFt / board.heightFt;
  const pitchMm    = board.pixelPitch || 10;
  const pitchCode  = board.pitchCode  || 'P10';

  // Physical width in mm → total pixel columns
  const widthMm    = board.widthFt * 304.8;
  const totalCols  = Math.round(widthMm / pitchMm);
  const heightMm   = board.heightFt * 304.8;
  const totalRows  = Math.round(heightMm / pitchMm);

  const linesHTML = board.lines.map(l => {
    // fontSize is stored in "LED pixels"; translate to vw
    const vwSize = (l.fontSize / totalCols) * 100;
    return `
  <div style="
    font-family:${l.fontFamily};
    font-size:clamp(10px, ${vwSize}vw, ${l.fontSize * 3}px);
    color:${l.color};
    font-weight:${l.bold ? 700 : 400};
    font-style:${l.italic ? 'italic' : 'normal'};
    text-decoration:${l.underline ? 'underline' : 'none'};
    text-align:${l.align};
    letter-spacing:${l.letterSpacing}px;
    line-height:1.08;
    width:100%;
    display:block;
  ">${l.text}</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Display — ${board.widthFt}×${board.heightFt}ft ${pitchCode}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Syne:wght@700;800&family=Oswald:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background: transparent; overflow: hidden; }
    .board {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      aspect-ratio: ${aspect};
      width: min(100vw, calc(100vh * ${aspect}));
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: 0;
      padding: 0;
    }
  </style>
</head>
<body>
<div class="board">
${linesHTML}
</div>
</body>
</html>`;
}

/* POST — create image board */
router.post('/image', async (req, res) => {
  try {
    const { imageData, widthFt, heightFt, pixelPitch, pitchCode, slug: requestedSlug } = req.body;
    if (!imageData) return res.status(400).json({ error: 'Base64 image data is required.' });
    if (!widthFt || !heightFt) return res.status(400).json({ error: 'Board width and height are required.' });

    let s = requestedSlug;
    if (!s) {
      do { s = slug(); } while (await Board.findOne({ slug: s }));
    } else if (await Board.findOne({ slug: s })) {
      return res.status(400).json({ error: 'Slug already exists.' });
    }

    const board = new Board({
      slug: s,
      widthFt,
      heightFt,
      pixelPitch: pixelPitch || 10,
      pitchCode: pitchCode || 'P10',
      imageData,
      lines: [],
    });
    board.generatedHTML = buildHTML(board);
    await board.save();

    res.status(201).json({ success: true, slug: s, url: `/board/${s}`, board });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST — create */
router.post('/', async (req, res) => {
  try {
    const { widthFt, heightFt, lines, pixelPitch, pitchCode } = req.body;
    if (!lines?.length) return res.status(400).json({ error: 'At least one text line required.' });

    let s;
    do { s = slug(); } while (await Board.findOne({ slug: s }));

    const board = new Board({
      slug: s, widthFt, heightFt, lines,
      pixelPitch: pixelPitch || 10,
      pitchCode:  pitchCode  || 'P10',
    });
    board.generatedHTML = buildHTML(board);
    await board.save();

    res.status(201).json({ success: true, slug: s, url: `/board/${s}`, board });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET — list all */
router.get('/', async (req, res) => {
  try {
    const boards = await Board.find({}, 'slug widthFt heightFt pixelPitch pitchCode createdAt views lines')
      .sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, boards });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* GET — one by slug */
router.get('/:slug', async (req, res) => {
  try {
    const board = await Board.findOne({ slug: req.params.slug });
    if (!board) return res.status(404).json({ error: 'Not found.' });
    board.views++;
    await board.save();
    res.json({ success: true, board });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* PUT — update */
router.put('/:slug', async (req, res) => {
  try {
    const board = await Board.findOne({ slug: req.params.slug });
    if (!board) return res.status(404).json({ error: 'Not found.' });
    const { widthFt, heightFt, lines, pixelPitch, pitchCode, imageData } = req.body;
    if (widthFt)    board.widthFt    = widthFt;
    if (heightFt)   board.heightFt   = heightFt;
    if (lines)      board.lines      = lines;
    if (pixelPitch) board.pixelPitch = pixelPitch;
    if (pitchCode)  board.pitchCode  = pitchCode;
    if (imageData !== undefined) board.imageData = imageData || undefined;
    board.generatedHTML = buildHTML(board);
    await board.save();
    res.json({ success: true, board });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* DELETE */
router.delete('/:slug', async (req, res) => {
  try {
    const b = await Board.findOneAndDelete({ slug: req.params.slug });
    if (!b) return res.status(404).json({ error: 'Not found.' });
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
