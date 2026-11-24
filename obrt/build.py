# Gradi samostalnu aplikaciju "Mjerenje" iz TerenRad index.html (samo faza mjerenja, podaci lokalno).
import re, sys, pathlib
src = pathlib.Path(sys.argv[1]).read_text()
shim = pathlib.Path(__file__).with_name('shim.js').read_text()
s = src
def rep(a, b, n=1):
    global s
    if s.count(a) != n: raise SystemExit(f'Nije nađeno ({s.count(a)}x): {a[:70]}')
    s = s.replace(a, b)
rep('''  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-storage-compat.js"></script>''', '<script>\n' + shim + '\n</script>')
rep('<title>TerenRad - Sustav Radnih Naloga</title>', '<title>Mjerenje – izmjera otvora</title>')
s = re.sub(r'<div class="logo">TEREN<span>RAD</span> <small([^>]*)>v([0-9.]+)</small></div>',
           r'<div class="logo">MJERE<span>NJE</span> <small\1>v\2</small></div>', s, count=1)
rep("'Portal Montaža i Servis – TerenRad'", "'Mjerenje'", 2)
s = s.replace('otvori TerenRad u', 'otvori aplikaciju u')
css = '''
    /* SAMOSTALNA APLIKACIJA: samo mjerenje */
    #btnPinNav, #userBadge, #loginModal, #pinModal, #statusFilters,
    #fazeTraka .faza-btn:not(:first-child), #fazeTraka,
    #detailPanel .card[data-faza]:not([data-faza="1"]) { display: none !important; }
    #detailPanel .card[data-faza="1"] { display: block !important; }
    .lokalno-info { font-size: 11px; color: #64748b; text-align: center; padding: 6px; }
'''
rep('</style>', css + '  </style>' if s.count('  </style>') == 1 else css + '</style>')
post = '''
<script>
  // samostalna verzija: uređivanje podataka dopušteno, sve ostaje na uređaju
  try { canViewFinancialDocs = function () { return true; }; } catch (e) {}
  try { fazaZadana = function () { return 1; }; } catch (e) {}
  try { otvoriFazu = function () {}; } catch (e) {}
  try { localStorage.setItem('teren_faze_sve', '0'); } catch (e) {}
  document.addEventListener('DOMContentLoaded', () => {
    const l = document.getElementById('projectList');
    if (l && l.parentNode) { const d = document.createElement('div'); d.className = 'lokalno-info'; d.textContent = '🔒 Mjerenja se spremaju samo na ovom uređaju. Pošalji ih kao PDF (📤 Spremi sheme).'; l.parentNode.insertBefore(d, l); }
  });
</script>
</body>'''
rep('</body>', post)
pathlib.Path(sys.argv[2]).write_text(s)
print('OK', len(s))
