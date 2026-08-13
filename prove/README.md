# Banco di prova

Verifica automatica dei flussi principali sostituendo Firebase con un finto SDK
in memoria (`finto-firebase/`): gira offline e **non scrive nulla di reale**.

```bash
npm install playwright
npx playwright install chromium
python3 -m http.server 8000        # dalla cartella del progetto
BASE=http://localhost:8000 node prove/prova.mjs
```

Esito atteso: tutte le verifiche superate (29/29).
Dopo ogni modifica all'app, rilancia le prove prima di fare `git push`.
