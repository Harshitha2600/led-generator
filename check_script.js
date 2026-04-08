const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const re = /<script>([\s\S]*?)<\/script>/g;
let match;
let idx = 0;
while ((match = re.exec(html))) {
  idx += 1;
  const code = match[1];
  const tempFile = path.join(__dirname, `tmp_inline_${idx}.js`);
  fs.writeFileSync(tempFile, code, 'utf8');
  try {
    execFileSync('node', ['--check', tempFile], { stdio: 'inherit' });
    console.log(`script ${idx} ok`);
  } catch (err) {
    console.error(`script ${idx} ERROR`);
    process.exit(1);
  } finally {
    fs.unlinkSync(tempFile);
  }
}
console.log(`checked ${idx} inline script(s)`);
