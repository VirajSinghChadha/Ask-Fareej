"""Package the production build as a self-contained HTML file and source ZIP."""
from pathlib import Path
import argparse
import base64
import re
import zipfile

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)

def data_uri(path, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()

html = (root / 'dist/index.html').read_text()
js_files = list((root / 'dist/assets').glob('*.js'))
css_files = list((root / 'dist/assets').glob('*.css'))
if len(js_files) != 1 or len(css_files) != 1:
    raise SystemExit('Expected exactly one bundled script and stylesheet. Run npm run build first.')
js = js_files[0].read_text()
css = css_files[0].read_text()
css = css.replace('/architecture.jpg', data_uri(root / 'public/architecture.jpg', 'image/jpeg'))
logo = data_uri(root / 'public/ask-fareej-logo.png', 'image/png')
js = js.replace('./ask-fareej-logo.png', logo)
html = re.sub(r'<script type="module"[^>]*src="[^"]+"[^>]*></script>', '', html)
html = re.sub(r'<link rel="stylesheet"[^>]+>', '', html)
html = html.replace('./ask-fareej-logo.png', logo)
html = html.replace('</head>', '<style>' + css + '</style></head>')
html = html.replace('</body>', '<script type="module">' + js.replace('</script', '<\\/script') + '</script></body>')
(out / 'Ask-Fareej.html').write_text(html)
with zipfile.ZipFile(out / 'askfareejmarketing-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in root.rglob('*'):
        relative = path.relative_to(root)
        if not path.is_file() or any(part in {'node_modules', 'dist', '.git', '.openai', '__pycache__'} for part in relative.parts):
            continue
        if path.name.endswith('.tsbuildinfo'):
            continue
        archive.write(path, 'askfareejmarketing/' + str(relative))
print('Packaged standalone HTML with embedded architecture and official logo, plus source ZIP.')
