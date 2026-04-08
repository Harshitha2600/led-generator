const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');

// Find and replace the old renderImageBoard function
const startIdx = content.indexOf('  function renderImageBoard()');
const endIdx = content.indexOf('  window.addEventListener(\'resize\'');

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find renderImageBoard function');
  process.exit(1);
}

const before = content.substring(0, startIdx);
const after = content.substring(endIdx);

const newFunc = `  function renderImageBoard() {
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

`;

const updated = before + newFunc + after;
fs.writeFileSync('server.js', updated);
console.log('✅ server.js updated with clean image rendering');
