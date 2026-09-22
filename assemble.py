from pathlib import Path
base=Path('revision/index.html').read_text()
if '/* EXTENSION */' not in base:
 base=base[:base.index('// Existing kv identifiers')]+ '/* EXTENSION */\nrender();\n</script>\n</body>\n</html>\n'
sources='\n'.join(Path('revision/'+p).read_text() for p in ['storage.js','economic.js','yer-rates.js','access.js'])
Path('revision/index.html').write_text(base.replace('/* EXTENSION */',sources))
form='''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Condiciones económicas ACA</title><body style="background:#f4f1f8"><main id="form"></main><script>function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}\n'''+Path('revision/economic.js').read_text()+'''\nmountEconomic(document.getElementById('form'),blankEconomic('3611'),null);</script></body></html>'''
Path('revision/formulario-condiciones.html').write_text(form)
import re
Path('check.js').write_text('\n'.join(re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>',Path('revision/index.html').read_text())))
