# Molinaro Cantieri — Guida al setup

Procedura per mettere in funzione la WebApp **Molinaro Cantieri** (giornale di
cantiere digitale). Questa versione è **completamente autonoma**: non legge e
non scrive nulla sul progetto Magazzino. Cantieri, dipendenti e mezzi vivono in
questo nuovo progetto e si gestiscono dall'area responsabile della app stessa.

Tempo stimato: **25–30 minuti**, tutto da browser tranne il caricamento su GitHub.

---

## Architettura

```
┌───────────────────────────────────────────────┐
│  Firebase "Molinaro Cantieri"  (NUOVO)         │
│                                                │
│  Authentication: email + password              │
│  Firestore:                                    │
│    utenti · cantieri · dipendenti · mezzi      │
│    report · qualifiche · catalogo_qualifiche   │
└───────────────────────┬────────────────────────┘
                        │  lettura + scrittura
             ┌──────────▼───────────┐
             │  WebApp Cantieri     │
             │  (PWA, GitHub Pages) │
             └──────────────────────┘
```

Il progetto Magazzino **non viene toccato in alcun modo**. Se in futuro vorrai
collegare i due (leggere dipendenti/cantieri/mezzi dal Magazzino invece di
gestirli qui) si potrà fare senza rifare nulla: basterà cambiare la sorgente
dati. Per ora restano due mondi separati, così eviti qualsiasi conflitto.

---

## Blocco A — Progetto Firebase

### A1. Crea il progetto

1. Vai su [console.firebase.google.com](https://console.firebase.google.com).
2. **Aggiungi progetto** → nome: `Molinaro Cantieri`.
3. Annota l'**ID progetto** proposto (es. `molinaro-cantieri-xxxxx`).
4. Google Analytics: puoi **disattivarlo**.

### A2. Firestore

1. **Build → Firestore Database → Crea database**.
2. **Avvia in modalità produzione** (le regole le mettiamo al punto A4).
3. Località: **`eur3 (europe-west)`** oppure `europe-west8 (Milano)`.
   ⚠️ Non modificabile dopo la creazione.

### A3. Autenticazione

1. **Build → Authentication → Inizia**.
2. **Sign-in method → Email/Password → Attiva** il primo interruttore → Salva.

### A4. Regole di sicurezza

**Firestore Database → scheda Regole**: incolla il contenuto del file
[`firestore.rules`](firestore.rules) e premi **Pubblica**.

### A5. Registra l'app web e copia la configurazione

1. **Impostazioni progetto** (ingranaggio) → **Le tue app** → icona **`</>`**.
2. Nickname: `Cantieri Web`. **Non** attivare Firebase Hosting.
3. Copia il blocco `firebaseConfig` e incollalo in
   [`js/firebase.js`](js/firebase.js) al posto dei segnaposto.

> Questi valori non sono segreti: identificano il progetto, non autorizzano
> nulla. La sicurezza sta tutta nelle regole del punto A4. Vanno bene in un
> repository pubblico.

### A6. Autorizza il dominio di GitHub Pages

**Authentication → Impostazioni → Domini autorizzati → Aggiungi dominio**:

```
<tuo-utente-github>.github.io
```

Senza questo il login funziona in locale ma non online.

---

## Blocco B — Repository GitHub e pubblicazione

### B1. Crea il repository

[github.com/new](https://github.com/new) → nome `molinaro-cantieri`,
visibilità **Public** (necessaria per Pages sul piano gratuito).

### B2. Carica il progetto

```bash
git init
git add .
git commit -m "WebApp Molinaro Cantieri"
git branch -M main
git remote add origin https://github.com/<tuo-utente>/molinaro-cantieri.git
git push -u origin main
```

### B3. Attiva Pages

**Settings → Pages → Source: Deploy from a branch** → branch `main`, cartella
`/ (root)` → **Save**. Dopo un paio di minuti la app è su:

```
https://<tuo-utente>.github.io/molinaro-cantieri/
```

Ogni `git push` successivo ripubblica in automatico.

---

## Blocco C — Primo utente responsabile

Va creato a mano una volta sola: è chi poi crea tutti gli altri accessi
dall'interfaccia.

1. **Authentication → Utenti → Aggiungi utente**: la tua email e una password.
   Copia lo **UID** generato.
2. **Firestore → Avvia raccolta** → ID raccolta: `utenti`.
3. **ID documento**: incolla **esattamente lo UID** del punto 1. Campi:

| Campo | Tipo | Valore |
|---|---|---|
| `email` | string | la tua email |
| `nome` | string | Nome e cognome |
| `ruolo` | string | `responsabile` |
| `attivo` | boolean | `true` |

Da questo momento accedi, entri nell'area responsabile e da lì crei cantieri,
dipendenti, mezzi e gli account degli operai.

---

## Blocco D — Primo popolamento (dall'app)

Entrato come responsabile:

1. **Anagrafiche → Cantieri** → pulsante **+** → aggiungi i cantieri attivi.
2. **Anagrafiche → Dipendenti** → aggiungi gli operai; su ciascuno puoi
   assegnare le **qualifiche** (es. *Mario Rossi → Specializzato in conduzione
   macchine*).
3. **Anagrafiche → Mezzi** → aggiungi i mezzi aziendali.
4. **Menu (☰) → Gestione utenti → Crea nuovo accesso** → un account per ogni
   operaio che deve compilare i report.

Da qui gli operai accedono, scelgono cantiere/dipendenti/mezzi da elenchi già
pronti e inviano il report; tu li vedi tutti in **Report**.

---

## Modello dati

**`utenti/{uid}`** — `{ email, nome, ruolo: operaio|responsabile, dipendenteId, attivo }`
**`cantieri/{id}`** — `{ nome, indirizzo, attivo }`
**`dipendenti/{id}`** — `{ nome, mansione, attivo }`
**`mezzi/{id}`** — `{ nome, targa, attivo }`
**`report/{id}`** — `{ data, cantiereId, cantiereNome, spese, materiali, descrizione, dipendenti[], mezzi[], creatoDa, creatoDaNome, creatoIl, stato }`
**`qualifiche/{dipendenteId}`** — `{ nome, voci[] }`
**`catalogo_qualifiche/{id}`** — `{ testo }`

> **Perché i report salvano anche i nomi** (non solo gli ID) di cantiere,
> dipendenti e mezzi: il giornale ha valore documentale e deve restare leggibile
> negli anni, anche se un cantiere viene chiuso o un mezzo dismesso. "Eliminare"
> una voce dall'anagrafica la disattiva soltanto: lo storico resta intatto.

### Indici Firestore

Firestore li propone da solo con un link nell'errore la prima volta che servono.
Questo servirà di sicuro — crealo in anticipo da **Firestore → Indici**:

| Collection | Campi |
|---|---|
| `report` | `creatoDa` ASC + `data` DESC |

---

## Note tecniche

**Dettatura vocale** — usa le Web Speech API (`it-IT`). Funziona su Chrome
Android (i telefoni Samsung delle foto vanno benissimo) e su Safari iOS ≥ 14.5.
Richiede HTTPS, garantito da GitHub Pages. Dove non c'è, i pulsanti spariscono
da soli e resta la digitazione: nessun messaggio d'errore per chi non è pratico.

**Offline** — la cache di Firestore accoda i report compilati senza campo e li
invia da sola al ritorno della rete. Il form salva inoltre una bozza locale a
ogni modifica: se il telefono si spegne, al rientro ritrovi tutto.

**Installazione** — con manifest e service worker la app si installa dal browser
(«Aggiungi a schermata Home») e si apre a schermo intero con l'icona Molinaro.

---

## Checklist

- [ ] Progetto `Molinaro Cantieri` creato
- [ ] Firestore attivo in `europe-west`
- [ ] Email/Password attivo
- [ ] Regole pubblicate (`firestore.rules`)
- [ ] `firebaseConfig` incollata in `js/firebase.js`
- [ ] Dominio `*.github.io` autorizzato
- [ ] Repo pubblicato e Pages attivo
- [ ] Primo responsabile creato (Auth + documento in `utenti`)
- [ ] Cantieri, dipendenti, mezzi inseriti dall'app
- [ ] Account operai creati
- [ ] Login di prova dal telefono riuscito
