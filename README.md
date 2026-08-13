# Molinaro Cantieri

Giornale di cantiere digitale per **Molinaro ESCo — Energy Service Company**.
Gli operai compilano il report della giornata dal telefono (anche a voce); il
responsabile li consulta, li approva, gestisce anagrafiche e qualifiche.

Stessa veste grafica della WebApp **Magazzino Molinaro** (tema chiaro, DM Sans,
verde ESCo), così per chi la usa è un ambiente familiare.

Progetto **autonomo**: un solo progetto Firebase, nessun collegamento al
Magazzino.

---

## Funzioni

**Operaio**

- Report giornaliero: cantiere, data, spese, materiali, descrizione, squadra, mezzi
- **Dettatura vocale** su spese, materiali e descrizione (un pulsante avvia, uno ferma)
- Salvataggio automatico della bozza; invio anche **senza rete** (coda offline)
- Storico dei propri report, modificabili finché non approvati

**Responsabile**

- Tutti i report con filtri per cantiere, periodo e stato; approvazione ed export CSV
- **Anagrafiche**: cantieri, dipendenti, mezzi (creazione, modifica, disattivazione)
- **Qualifiche**: assegnazione di specializzazioni ai dipendenti, con catalogo riutilizzabile
- **Statistiche**: report per cantiere, presenze, utilizzo mezzi
- **Gestione utenti**: creazione accessi, cambio ruolo, attivazione

---

## Struttura

```
molinaro-cantieri/
├── index.html          accesso (clone della login Magazzino)
├── app.html            applicazione (SPA: header + nav + pagine)
├── css/app.css         design system (tema chiaro ESCo)
├── js/
│   ├── firebase.js     ⚙️  UNICO file da compilare (config Firebase)
│   ├── auth.js         accesso, profili, creazione utenti
│   ├── store.js        Firestore: report, anagrafiche, qualifiche, statistiche, CSV
│   ├── ui.js           toast, modali bottom-sheet, selettori, date
│   ├── dettatura.js    dettatura vocale (Web Speech API)
│   └── app.js          orchestratore della SPA
├── assets/             logo e icone Molinaro (ripresi dal Magazzino)
├── manifest.json       installazione PWA
├── sw.js               service worker (avvio offline)
├── firestore.rules     regole di sicurezza
├── prove/              banco di prova automatico
└── GUIDA-SETUP.md      procedura passo passo
```

Nessuna build, nessun bundler: file statici. L'SDK Firebase arriva come modulo
ES da `gstatic.com` (versione 10.12.0, la stessa del Magazzino).

---

## Avvio rapido

Procedura completa in **[GUIDA-SETUP.md](GUIDA-SETUP.md)**. In sintesi: crea il
progetto Firebase, incolla `firestore.rules`, compila `js/firebase.js`, fai
`git push` e attiva Pages, crea il primo responsabile a mano, poi popola
cantieri/dipendenti/mezzi dall'app.

### Prova in locale

```bash
python3 -m http.server 8000
# apri http://localhost:8000
```

`localhost` è contesto sicuro: anche la dettatura funziona in prova.

### Banco di prova

```bash
npm install playwright && npx playwright install chromium
python3 -m http.server 8000 &
node prove/prova.mjs      # atteso: tutte le verifiche superate
```

Il test sostituisce Firebase con un finto SDK in memoria: gira offline e non
scrive nulla di reale.

---

## Personalizzazione

**Colori** — tutti nel blocco `:root` di `css/app.css`. Cambiando `--brand-500`
cambia l'intera interfaccia.

**Logo/icone** — in `assets/` (già quelli ufficiali del Magazzino).

**Dopo ogni modifica ai file**, incrementa `VERSIONE` in `sw.js`: è ciò che fa
arrivare l'aggiornamento sui telefoni già installati.

---

## Compatibilità

| | Chrome Android | Safari iOS | Desktop |
|---|---|---|---|
| WebApp | ✅ | ✅ | ✅ |
| Dettatura vocale | ✅ | ✅ ≥ 14.5 | ✅ |
| Installazione | ✅ | ✅ | ✅ |
| Uso offline | ✅ | ✅ | ✅ |

Le chiavi in `firebase.js` non sono segrete. Non inserire mai nel repository un
file di *service account* (`*-firebase-adminsdk-*.json`): il `.gitignore` lo
esclude già.
