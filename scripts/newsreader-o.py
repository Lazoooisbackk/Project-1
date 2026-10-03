"""
Holt die Kontur des O aus Newsreader (wght 500 / opsz 18, die Form des alten Logos) und schreibt
scripts/newsreader-o.json, das scripts/wordmark.mjs für das O der Wortmarke einliest.
Voraussetzung: pip install fonttools brotli   (und npm install, wegen @fontsource-variable/newsreader)
Aufruf: python3 scripts/newsreader-o.py
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / 'node_modules/@fontsource-variable/newsreader/files/newsreader-latin-standard-normal.woff2'
AXES = {'wght': 500, 'opsz': 18}

font = instancer.instantiateVariableFont(TTFont(FONT), AXES)
glyphs = font.getGlyphSet()
name = font.getBestCmap()[ord('O')]
pen = SVGPathPen(glyphs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
glyphs[name].draw(pen)
bounds = BoundsPen(glyphs)
glyphs[name].draw(bounds)
out = {
    'quelle': 'Newsreader (SIL OFL 1.1), @fontsource-variable/newsreader 5.3.0, newsreader-latin-standard-normal.woff2, Instanz wght 500 / opsz 18 (wie auf der alten Logo-Seite)',
    'unitsPerEm': font['head'].unitsPerEm,
    'glyph': 'O',
    'd': pen.getCommands(),
    'bounds': [round(v, 2) for v in bounds.bounds],
    'capHeight': font['OS/2'].sCapHeight,
}
(ROOT / 'scripts/newsreader-o.json').write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print('O', out['bounds'], 'cap', out['capHeight'])
