from pathlib import Path
path = Path('public/index.html')
text = path.read_text(encoding='utf8')
start = text.find('<script>\n/* ══════════════════════════')
end = text.rfind('</script>')
if start == -1 or end == -1:
    raise SystemExit('Markers not found')
new_text = text[:start] + '<script defer src="app.js"></script>\n</body>\n</html>'
path.write_text(new_text, encoding='utf8')
print('updated script reference')
