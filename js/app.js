/* ==========================================================================
   app.js — Orchestratore della SPA Cantieri
   ========================================================================== */

import { firebaseConfig } from './firebase.js';
import {
  osservaAccesso, profiloCorrente, isResp, esci, creaUtente, messaggioErrore
} from './auth.js';
import {
  getAnagrafiche, getCantieri, getDipendenti, getMezzi,
  creaVoce, aggiornaVoce, disattivaVoce,
  creaReport, aggiornaReport, getReport, getMieiReport, getReportFiltrati,
  eliminaReport, approvaReport, riapriReport,
  getTutteLeQualifiche, aggiungiQualifica, rimuoviQualifica,
  getCatalogo, aggiungiAlCatalogo,
  getUtenti, aggiornaUtente,
  calcolaStatistiche, reportInCSV, scarica
} from './store.js';
import { collegaTutteLeDettature, dettaturaDisponibile } from './dettatura.js';
import {
  $, $$, esc, toast, iniziali, oggiISO, dataIT, dataEstesa, istanteIT,
  loader, vuoto, erroreBox, scegli, conferma, form, sheet, sorveglianzaRete
} from './ui.js';

/* ============================================================ stato app === */

let me = null;
let anagrafiche = { cantieri: [], dipendenti: [], mezzi: [] };
let paginaCorrente = 'home';

/* =============================================================== avvio ==== */

osservaAccesso((profilo, motivo) => {
  if (!profilo) {
    location.replace('index.html' + (motivo ? `?m=${motivo}` : ''));
    return;
  }
  me = profilo;
  avvia();
});

function avvia() {
  // barra utente
  $('#user-avatar').textContent = iniziali(me.nome);
  $('#user-name').textContent = me.nome.split(' ')[0];

  // nav in base al ruolo
  if (isResp()) {
    $('#nav-anag').classList.remove('hidden');
    $('#nav-stat').classList.remove('hidden');
    $('#hamburger-btn').style.display = 'flex';
    $('#home-resp').classList.remove('hidden');
  }

  // saluto home
  $('#home-title').textContent = `Ciao ${me.nome.split(' ')[0]}`;
  $('#home-meta').textContent = isResp()
    ? 'Da qui compili i report e gestisci cantieri, dipendenti, mezzi, qualifiche e statistiche.'
    : 'Da qui compili il report della giornata e rivedi quelli che hai già inviato.';

  collegaEventi();
  sorveglianzaRete('offline-bar');

  // precarico anagrafiche in sottofondo (servono al form)
  caricaAnagrafiche();

  $('#loading-screen').style.display = 'none';
  vaiA('home');
}

async function caricaAnagrafiche() {
  try { anagrafiche = await getAnagrafiche(); }
  catch (e) { console.warn('[anagrafiche]', e); }
}

/* ========================================================== navigazione === */

function vaiA(id) {
  paginaCorrente = id;
  $$('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${id}`));
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.goto === id));
  window.scrollTo(0, 0);

  const fab = $('#fab');
  fab.classList.add('hidden');

  if (id === 'nuovo')  initNuovo();
  if (id === 'report') initReport();
  if (id === 'anag')   initAnag();
  if (id === 'stat')   initStat();
  if (id === 'utenti') initUtenti();
  if (id === 'home' && isResp()) caricaHomeStats();
}

function collegaEventi() {
  $$('[data-goto]').forEach((el) =>
    el.addEventListener('click', () => vaiA(el.dataset.goto)));

  // logout
  $('#header-user').addEventListener('click', logout);
  $('#menu-esci').addEventListener('click', logout);

  // hamburger
  const menu = $('#hamburger-menu'), back = $('#hamburger-backdrop');
  const chiudiMenu = () => { menu.classList.remove('open'); back.classList.remove('open'); };
  $('#hamburger-btn').addEventListener('click', () => {
    menu.classList.toggle('open'); back.classList.toggle('open');
  });
  back.addEventListener('click', chiudiMenu);
  $$('.hamburger-menu-item').forEach((el) => el.addEventListener('click', chiudiMenu));

  // sub-tab anagrafiche
  $$('#anag-tabs .subtab').forEach((t) =>
    t.addEventListener('click', () => {
      $$('#anag-tabs .subtab').forEach((x) => x.classList.toggle('active', x === t));
      renderAnag(t.dataset.anag);
    }));

  $('#stat-periodo').addEventListener('change', renderStat);
  $('#btn-nuovo-utente').addEventListener('click', creaUtenteDialog);

  wireNuovo();
}

async function logout() {
  await esci();
  location.replace('index.html');
}

/* ================================================================ HOME ==== */

async function caricaHomeStats() {
  const cont = $('#home-stats');
  loader(cont, 'Calcolo…');
  try {
    const report = await getReportFiltrati({ quanti: 1000 });
    const s = calcolaStatistiche(report);
    cont.innerHTML = tile(s.totale, 'Report totali') + tile(s.daApprovare, 'Da approvare');
  } catch (e) {
    cont.innerHTML = '';
  }
}
const tile = (v, l) => `<div class="stat-card"><div class="stat-val">${v}</div><div class="stat-label">${esc(l)}</div></div>`;

/* =========================================================== NUOVO REPORT = */

const scelta = { cantiere: null, dipendenti: [], mezzi: [] };
let idModifica = null;
let dettatureCollegate = false;

function wireNuovo() {
  $('#pick-cantiere').addEventListener('click', async () => {
    if (!anagrafiche.cantieri.length) { toast('Nessun cantiere disponibile. Chiedi al responsabile di aggiungerli.', 'warn', 4500); return; }
    const r = await scegli({ titolo: 'Seleziona cantiere', elementi: anagrafiche.cantieri,
      selezionati: scelta.cantiere ? [scelta.cantiere.id] : [], multiplo: false });
    if (r && r.length) { scelta.cantiere = r[0]; disegnaCantiere(); salvaBozza(); }
  });

  $('#pick-dipendenti').addEventListener('click', async () => {
    const r = await scegli({ titolo: 'Seleziona dipendenti', elementi: anagrafiche.dipendenti,
      selezionati: scelta.dipendenti.map((d) => d.id) });
    if (r) { scelta.dipendenti = r; disegnaChip('dipendenti'); salvaBozza(); }
  });

  $('#pick-mezzi').addEventListener('click', async () => {
    const r = await scegli({ titolo: 'Seleziona mezzi', elementi: anagrafiche.mezzi,
      selezionati: scelta.mezzi.map((m) => m.id) });
    if (r) { scelta.mezzi = r; disegnaChip('mezzi'); salvaBozza(); }
  });

  ['f-data', 'f-spese', 'f-materiali', 'f-descrizione'].forEach((id) =>
    $(`#${id}`).addEventListener('input', salvaBozza));

  $('#btn-invia').addEventListener('click', inviaReport);
}

const CHIAVE_BOZZA = () => `molinaro:cantieri:bozza:${me.uid}`;

async function initNuovo() {
  // dettatura (una volta sola)
  if (!dettatureCollegate) {
    collegaTutteLeDettature();
    $('#detta-hint').textContent = dettaturaDisponibile()
      ? 'Puoi scrivere a mano oppure premere «Inizia dettatura» e parlare: il testo compare da solo.'
      : 'La dettatura vocale non è disponibile su questo browser. Usa Chrome per attivarla.';
    dettatureCollegate = true;
  }

  if (!anagrafiche.cantieri.length && !anagrafiche.dipendenti.length) await caricaAnagrafiche();

  // se non stiamo modificando, riprendi bozza
  if (!idModifica) {
    $('#nuovo-label').textContent = 'Nuovo report';
    $('#btn-invia').textContent = 'Invia Report';
    let bozza = null;
    try { bozza = JSON.parse(localStorage.getItem(CHIAVE_BOZZA()) || 'null'); } catch {}
    if (bozza && (bozza.spese || bozza.materiali || bozza.descrizione || bozza.cantiere)) {
      applicaDati(bozza);
      toast('Ripreso il report lasciato in sospeso.', 'info', 4000);
    } else {
      resetForm();
    }
  }
}

function resetForm() {
  $('#f-data').value = oggiISO();
  ['f-spese', 'f-materiali', 'f-descrizione'].forEach((id) => { $(`#${id}`).value = ''; });
  scelta.cantiere = null; scelta.dipendenti = []; scelta.mezzi = [];
  disegnaCantiere(); disegnaChip('dipendenti'); disegnaChip('mezzi');
  $('#nuovo-err').innerHTML = '';
}

function applicaDati(d) {
  $('#f-data').value = d.data || oggiISO();
  $('#f-spese').value = d.spese || '';
  $('#f-materiali').value = d.materiali || '';
  $('#f-descrizione').value = d.descrizione || '';
  scelta.cantiere = d.cantiere || null;
  scelta.dipendenti = d.dipendenti || [];
  scelta.mezzi = d.mezzi || [];
  disegnaCantiere(); disegnaChip('dipendenti'); disegnaChip('mezzi');
}

function disegnaCantiere() {
  const el = $('#v-cantiere');
  if (!scelta.cantiere) { el.textContent = 'Nessun cantiere selezionato'; el.classList.remove('filled'); return; }
  el.textContent = scelta.cantiere.nome + (scelta.cantiere.sub ? ` · ${scelta.cantiere.sub}` : '');
  el.classList.add('filled');
}

function disegnaChip(tipo) {
  const cont = $(`#chip-${tipo}`), val = $(`#v-${tipo}`);
  const arr = scelta[tipo];
  val.textContent = arr.length ? `${arr.length} selezionati` : (tipo === 'dipendenti' ? 'Nessun dipendente selezionato' : 'Nessun mezzo selezionato');
  val.classList.toggle('filled', arr.length > 0);
  cont.innerHTML = arr.map((e) => `<span class="chip">${esc(e.nome)}<button type="button" data-id="${esc(e.id)}" aria-label="Rimuovi">&times;</button></span>`).join('');
  cont.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    scelta[tipo] = scelta[tipo].filter((x) => x.id !== b.dataset.id);
    disegnaChip(tipo); salvaBozza();
  }));
}

function salvaBozza() {
  if (idModifica) return;
  try {
    localStorage.setItem(CHIAVE_BOZZA(), JSON.stringify({
      data: $('#f-data').value, spese: $('#f-spese').value,
      materiali: $('#f-materiali').value, descrizione: $('#f-descrizione').value,
      cantiere: scelta.cantiere, dipendenti: scelta.dipendenti, mezzi: scelta.mezzi
    }));
  } catch {}
}
function pulisciBozza() { try { localStorage.removeItem(CHIAVE_BOZZA()); } catch {} }

async function modificaReport(id) {
  const r = await getReport(id);
  if (!r) { toast('Report non trovato.', 'danger'); return; }
  idModifica = id;
  vaiA('nuovo');
  $('#nuovo-label').textContent = 'Modifica report';
  $('#btn-invia').textContent = 'Salva modifiche';
  applicaDati({
    data: r.data, spese: r.spese, materiali: r.materiali, descrizione: r.descrizione,
    cantiere: anagrafiche.cantieri.find((c) => c.id === r.cantiereId) || { id: r.cantiereId, nome: r.cantiereNome, sub: '' },
    dipendenti: r.dipendenti || [], mezzi: r.mezzi || []
  });
}

async function inviaReport() {
  $('#nuovo-err').innerHTML = '';
  const mancano = [];
  if (!$('#f-data').value) mancano.push('la data');
  if (!scelta.cantiere) mancano.push('il cantiere');
  if (!$('#f-descrizione').value.trim()) mancano.push('la descrizione dei lavori');
  if (mancano.length) {
    $('#nuovo-err').innerHTML = `<div class="notice notice-danger">Prima di inviare indica ${esc(mancano.join(', '))}.</div>`;
    $('#nuovo-err').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  const btn = $('#btn-invia');
  btn.disabled = true; btn.textContent = 'Invio…';

  const dati = {
    data: $('#f-data').value, cantiereId: scelta.cantiere.id, cantiereNome: scelta.cantiere.nome,
    spese: $('#f-spese').value, materiali: $('#f-materiali').value, descrizione: $('#f-descrizione').value,
    dipendenti: scelta.dipendenti, mezzi: scelta.mezzi
  };

  const conclusa = idModifica ? aggiornaReport(idModifica, dati) : creaReport(dati, me);
  const attesa = new Promise((r) => setTimeout(() => r('coda'), 2500));

  try {
    const esito = await Promise.race([conclusa.then(() => 'ok'), attesa]);
    pulisciBozza();
    const eraModifica = Boolean(idModifica);
    idModifica = null;
    if (esito === 'coda') toast('Report salvato. Verrà inviato appena torna la rete.', 'warn', 5000);
    else toast(eraModifica ? 'Modifiche salvate.' : 'Report inviato correttamente.', 'ok');
    resetForm();
    vaiA('report');
  } catch (e) {
    console.error(e);
    $('#nuovo-err').innerHTML = `<div class="notice notice-danger">Invio non riuscito: ${esc(e.message || e.code || '')}</div>`;
    btn.disabled = false; btn.textContent = idModifica ? 'Salva modifiche' : 'Invia Report';
  }
}

/* ================================================================ REPORT == */

async function initReport() {
  $('#report-label').textContent = isResp() ? 'Tutti i report' : 'I miei report';
  if (isResp()) montaFiltri();
  await renderReport();
}

function montaFiltri() {
  const cont = $('#report-filtri');
  cont.classList.remove('hidden');
  cont.innerHTML = `
    <div class="card">
      <div class="form-group"><label>Cantiere</label>
        <select id="rf-cantiere"><option value="">Tutti i cantieri</option>${
          anagrafiche.cantieri.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></div>
      <div class="form-row">
        <div class="form-group"><label>Dal</label><input type="date" id="rf-dal"></div>
        <div class="form-group"><label>Al</label><input type="date" id="rf-al"></div>
      </div>
      <div class="form-group" style="margin-bottom:14px"><label>Stato</label>
        <select id="rf-stato"><option value="">Tutti</option><option value="inviato">Da approvare</option><option value="approvato">Approvati</option></select></div>
      <button class="btn btn-green" id="rf-applica">Applica filtri</button>
      <button class="btn btn-outline" id="rf-azzera">Azzera</button>
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
      <button class="btn btn-soft btn-sm" id="rf-csv">Esporta CSV</button>
      <span id="rf-conteggio" style="color:var(--text-light);font-size:12.5px;font-weight:500"></span>
    </div>`;
  $('#rf-applica').addEventListener('click', renderReport);
  $('#rf-azzera').addEventListener('click', () => {
    ['rf-cantiere', 'rf-dal', 'rf-al', 'rf-stato'].forEach((id) => { $(`#${id}`).value = ''; });
    renderReport();
  });
  $('#rf-csv').addEventListener('click', esportaCSV);
}

let ultimiReport = [];

async function renderReport() {
  const cont = $('#report-lista');
  loader(cont, 'Carico i report…');
  try {
    if (isResp()) {
      ultimiReport = await getReportFiltrati({
        cantiereId: $('#rf-cantiere')?.value || undefined,
        dal: $('#rf-dal')?.value || undefined,
        al: $('#rf-al')?.value || undefined,
        stato: $('#rf-stato')?.value || undefined
      });
      const c = $('#rf-conteggio');
      if (c) c.textContent = ultimiReport.length === 1 ? '1 report' : `${ultimiReport.length} report`;
    } else {
      ultimiReport = await getMieiReport(me.uid);
    }

    if (!ultimiReport.length) {
      vuoto(cont, 'Nessun report', isResp() ? 'Prova ad allargare i filtri.' : 'Premi «Nuovo» per compilare il primo.');
      return;
    }

    cont.innerHTML = ultimiReport.map((r) => {
      const squadra = (r.dipendenti || []).map((d) => d.nome).join(', ');
      return `<button type="button" class="list-item" data-id="${esc(r.id)}">
        <div class="li-head"><span class="li-title">${esc(r.cantiereNome || 'Cantiere')}</span><span class="li-date">${esc(dataIT(r.data))}</span></div>
        <span class="badge badge-${r.stato === 'approvato' ? 'approvato' : 'inviato'}">${r.stato === 'approvato' ? 'Approvato' : (isResp() ? 'Da approvare' : 'Inviato')}</span>
        ${isResp() ? `<p class="li-row">Compilato da ${esc(r.creatoDaNome || '—')}</p>` : ''}
        ${r.descrizione ? `<p class="li-row">${esc(r.descrizione)}</p>` : ''}
        ${!isResp() && squadra ? `<p class="li-row">Squadra: ${esc(squadra)}</p>` : ''}
      </button>`;
    }).join('');

    cont.querySelectorAll('.list-item').forEach((el) =>
      el.addEventListener('click', () => apriReport(el.dataset.id)));
  } catch (e) {
    console.error(e);
    const idx = String(e.message || '').includes('index');
    erroreBox(cont, `Impossibile caricare i report.${idx ? ' Serve un indice Firestore: apri la console del browser e clicca il link che Firebase propone nell’errore.' : ''}`);
  }
}

async function apriReport(id) {
  const r = ultimiReport.find((x) => x.id === id) || await getReport(id);
  if (!r) { toast('Report non trovato.', 'danger'); return; }

  const blocco = (l, v) => v ? `<div class="detail"><div class="detail-label">${esc(l)}</div><div class="detail-value">${esc(v)}</div></div>` : '';
  const html = [
    blocco('Data', dataEstesa(r.data)),
    blocco('Cantiere', r.cantiereNome),
    isResp() ? blocco('Compilato da', r.creatoDaNome) : '',
    blocco('Inviato il', istanteIT(r.creatoIl)),
    blocco('Squadra', (r.dipendenti || []).map((d) => d.nome).join(', ')),
    blocco('Mezzi', (r.mezzi || []).map((m) => m.nome).join(', ')),
    blocco('Spese', r.spese),
    blocco('Materiali', r.materiali),
    blocco('Descrizione lavori', r.descrizione),
    `<div class="detail"><span class="badge badge-${r.stato === 'approvato' ? 'approvato' : 'inviato'}">${r.stato === 'approvato' ? 'Approvato' : 'Da approvare'}</span></div>`
  ].join('');

  const azioni = [];
  if (isResp()) {
    azioni.push({ label: r.stato === 'approvato' ? 'Riporta in «da approvare»' : 'Approva report', tipo: 'btn-green',
      onClick: async (chiudi) => {
        try { r.stato === 'approvato' ? await riapriReport(r.id) : await approvaReport(r.id);
          toast(r.stato === 'approvato' ? 'Report riaperto.' : 'Report approvato.'); chiudi(); renderReport(); }
        catch (e) { toast(messaggioErrore(e), 'danger'); }
      } });
    azioni.push({ label: 'Elimina report', tipo: 'btn-red', onClick: (chiudi) => eliminaDialog(r, chiudi) });
  } else if (r.stato !== 'approvato') {
    azioni.push({ label: 'Modifica report', tipo: 'btn-green', onClick: (chiudi) => { chiudi(); modificaReport(r.id); } });
  }
  azioni.push({ label: 'Chiudi', tipo: 'btn-outline', onClick: (chiudi) => chiudi() });

  sheet({ titolo: r.cantiereNome || 'Report', html, azioni });
}

async function eliminaDialog(r, chiudiSheet) {
  const ok = await conferma({ titolo: 'Eliminare il report?',
    messaggio: `Il report del ${dataIT(r.data)} per ${r.cantiereNome || 'il cantiere'} verrà cancellato definitivamente.`,
    testoOk: 'Elimina definitivamente', pericolo: true });
  if (!ok) return;
  try { await eliminaReport(r.id); toast('Report eliminato.'); chiudiSheet(); renderReport(); }
  catch (e) { toast(messaggioErrore(e), 'danger'); }
}

function esportaCSV() {
  if (!ultimiReport.length) { toast('Non c’è nulla da esportare.', 'warn'); return; }
  scarica(`report-cantieri-${oggiISO()}.csv`, reportInCSV(ultimiReport));
}

/* =========================================================== ANAGRAFICHE == */

let anagQualifiche = {}, anagCatalogo = [];

function initAnag() {
  const attiva = $('#anag-tabs .subtab.active')?.dataset.anag || 'cantieri';
  renderAnag(attiva);
}

const ETICH = {
  cantieri:   { sing: 'cantiere',   campoSub: 'indirizzo',  labelNome: 'Nome cantiere',  labelSub: 'Indirizzo / committente' },
  dipendenti: { sing: 'dipendente', campoSub: 'mansione',   labelNome: 'Nome e cognome',  labelSub: 'Mansione' },
  mezzi:      { sing: 'mezzo',      campoSub: 'targa',      labelNome: 'Nome / modello',  labelSub: 'Targa / tipo' }
};

async function renderAnag(tipo) {
  const body = $('#anag-body');
  loader(body, 'Carico…');

  // FAB per aggiungere
  const fab = $('#fab');
  fab.classList.remove('hidden');
  fab.onclick = () => aggiungiVoceDialog(tipo);

  try {
    let elementi;
    if (tipo === 'cantieri') elementi = await getCantieri();
    else if (tipo === 'mezzi') elementi = await getMezzi();
    else {
      [elementi, anagQualifiche, anagCatalogo] = await Promise.all([getDipendenti(), getTutteLeQualifiche(), getCatalogo()]);
    }

    // aggiorna cache in memoria per il form report
    anagrafiche[tipo] = elementi;

    if (!elementi.length) {
      vuoto(body, `Nessun ${ETICH[tipo].sing}`, 'Premi il pulsante + in basso a destra per aggiungerne uno.');
      return;
    }

    if (tipo === 'dipendenti') { renderDipendenti(elementi); return; }

    body.innerHTML = elementi.map((e) => `
      <div class="data-row">
        <div class="data-row-info"><div class="data-row-name">${esc(e.nome)}</div>${e.sub ? `<div class="data-row-sub">${esc(e.sub)}</div>` : ''}</div>
        <button class="data-row-edit" data-edit="${esc(e.id)}" aria-label="Modifica">✎</button>
        <button class="data-row-del" data-del="${esc(e.id)}" aria-label="Elimina">&times;</button>
      </div>`).join('');

    body.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => modificaVoceDialog(tipo, elementi.find((x) => x.id === b.dataset.edit))));
    body.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => eliminaVoceDialog(tipo, elementi.find((x) => x.id === b.dataset.del))));
  } catch (e) {
    console.error(e);
    erroreBox(body, `Impossibile caricare. ${e.message || ''}`);
  }
}

function renderDipendenti(elementi) {
  const body = $('#anag-body');
  body.innerHTML = elementi.map((d) => {
    const voci = anagQualifiche[d.id]?.voci || [];
    return `<div class="card">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="flex:1;min-width:0">
          <h3 style="margin-bottom:2px">${esc(d.nome)}</h3>
          ${d.sub ? `<p style="margin-bottom:10px">${esc(d.sub)}</p>` : '<div style="height:6px"></div>'}
        </div>
        <button class="data-row-edit" data-edit="${esc(d.id)}" aria-label="Modifica">✎</button>
        <button class="data-row-del" data-del="${esc(d.id)}" aria-label="Elimina">&times;</button>
      </div>
      ${voci.length
        ? `<div class="chip-list" style="margin:2px 0 12px">${voci.map((v, i) =>
            `<span class="chip">${esc(v.testo)}<button type="button" data-qdel="${esc(d.id)}:${i}" aria-label="Rimuovi">&times;</button></span>`).join('')}</div>`
        : `<p style="color:var(--text-light);font-style:italic;font-size:12.5px;margin:2px 0 12px">Nessuna qualifica assegnata</p>`}
      <button class="btn btn-soft btn-sm" data-qadd="${esc(d.id)}">Assegna qualifica</button>
    </div>`;
  }).join('');

  body.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => modificaVoceDialog('dipendenti', elementi.find((x) => x.id === b.dataset.edit))));
  body.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => eliminaVoceDialog('dipendenti', elementi.find((x) => x.id === b.dataset.del))));
  body.querySelectorAll('[data-qadd]').forEach((b) =>
    b.addEventListener('click', () => assegnaQualifica(elementi.find((x) => x.id === b.dataset.qadd))));
  body.querySelectorAll('[data-qdel]').forEach((b) =>
    b.addEventListener('click', () => {
      const [id, i] = b.dataset.qdel.split(':');
      rimuoviQualificaDialog(elementi.find((x) => x.id === id), Number(i));
    }));
}

async function aggiungiVoceDialog(tipo) {
  const et = ETICH[tipo];
  const val = await form({ titolo: `Nuovo ${et.sing}`, testoOk: 'Aggiungi', campi: [
    { name: 'nome', label: et.labelNome, required: true },
    { name: 'sub', label: et.labelSub }
  ] });
  if (!val) return;
  try {
    await creaVoce(tipo, { nome: val.nome, [et.campoSub]: val.sub });
    toast(`${cap(et.sing)} aggiunto.`);
    renderAnag(tipo); caricaAnagrafiche();
  } catch (e) { toast(messaggioErrore(e), 'danger'); }
}

async function modificaVoceDialog(tipo, voce) {
  if (!voce) return;
  const et = ETICH[tipo];
  const val = await form({ titolo: `Modifica ${et.sing}`, testoOk: 'Salva', campi: [
    { name: 'nome', label: et.labelNome, value: voce.nome, required: true },
    { name: 'sub', label: et.labelSub, value: voce.sub }
  ] });
  if (!val) return;
  try {
    await aggiornaVoce(tipo, voce.id, { nome: val.nome, [et.campoSub]: val.sub });
    toast('Modifiche salvate.');
    renderAnag(tipo); caricaAnagrafiche();
  } catch (e) { toast(messaggioErrore(e), 'danger'); }
}

async function eliminaVoceDialog(tipo, voce) {
  if (!voce) return;
  const et = ETICH[tipo];
  const ok = await conferma({ titolo: `Eliminare ${et.sing}?`,
    messaggio: `«${voce.nome}» non comparirà più nelle selezioni. I report già inviati che lo citano restano invariati.`,
    testoOk: 'Elimina', pericolo: true });
  if (!ok) return;
  try { await disattivaVoce(tipo, voce.id); toast(`${cap(et.sing)} eliminato.`); renderAnag(tipo); caricaAnagrafiche(); }
  catch (e) { toast(messaggioErrore(e), 'danger'); }
}

/* ------------------------------------------------------------ qualifiche -- */

async function assegnaQualifica(dip) {
  if (!dip) return;
  const NUOVA = '__nuova__';
  const scel = await scegli({ titolo: `Qualifica per ${dip.nome}`, multiplo: false, elementi: [
    { id: NUOVA, nome: '➕ Scrivi una nuova qualifica', sub: 'Verrà aggiunta al catalogo' },
    ...anagCatalogo.map((v) => ({ id: v.id, nome: v.testo, sub: '' }))
  ] });
  if (!scel || !scel.length) return;

  let testo = scel[0].nome;
  if (scel[0].id === NUOVA) {
    const val = await form({ titolo: 'Nuova qualifica', testoOk: 'Assegna', campi: [
      { name: 'testo', label: `Qualifica per ${dip.nome}`, required: true,
        placeholder: 'Es. Specializzato in conduzione macchine',
        hint: 'Esempio: Specializzato in conduzione macchine' }
    ] });
    if (!val) return;
    testo = val.testo;
    try { await aggiungiAlCatalogo(testo); anagCatalogo = await getCatalogo(); } catch (e) { console.warn(e); }
  }

  try {
    const voci = await aggiungiQualifica(dip.id, dip.nome, { testo }, me);
    anagQualifiche[dip.id] = { ...anagQualifiche[dip.id], voci };
    renderAnag('dipendenti');
    toast(`Qualifica assegnata a ${dip.nome}.`);
  } catch (e) { toast(messaggioErrore(e), 'danger'); }
}

async function rimuoviQualificaDialog(dip, indice) {
  if (!dip) return;
  const voce = anagQualifiche[dip.id]?.voci?.[indice];
  if (!voce) return;
  const ok = await conferma({ titolo: 'Rimuovere la qualifica?',
    messaggio: `«${voce.testo}» verrà tolta a ${dip.nome}.`, testoOk: 'Rimuovi', pericolo: true });
  if (!ok) return;
  try {
    const voci = await rimuoviQualifica(dip.id, dip.nome, indice);
    anagQualifiche[dip.id] = { ...anagQualifiche[dip.id], voci };
    renderAnag('dipendenti');
    toast('Qualifica rimossa.');
  } catch (e) { toast(messaggioErrore(e), 'danger'); }
}

/* ============================================================= STATISTICHE = */

function initStat() { renderStat(); }

function daQuando(giorni) {
  if (!giorni) return undefined;
  const d = new Date(); d.setDate(d.getDate() - giorni);
  return d.toISOString().slice(0, 10);
}

async function renderStat() {
  const body = $('#stat-body');
  loader(body, 'Calcolo…');
  try {
    const report = await getReportFiltrati({ dal: daQuando(Number($('#stat-periodo').value)), quanti: 1000 });
    if (!report.length) { vuoto(body, 'Nessun report nel periodo', 'Cambia periodo per vedere altri dati.'); return; }
    const s = calcolaStatistiche(report);
    body.innerHTML = `
      <div class="stats-grid cols-4">
        ${tile(s.totale, 'Report')}${tile(s.giornate, 'Giornate')}${tile(s.cantieriAttivi, 'Cantieri')}${tile(s.daApprovare, 'Da approvare')}
      </div>
      ${classifica('Report per cantiere', s.perCantiere)}
      ${classifica('Presenze per dipendente', s.perDipendente)}
      ${classifica('Utilizzo dei mezzi', s.perMezzo)}`;
  } catch (e) {
    console.error(e);
    erroreBox(body, `Impossibile calcolare le statistiche. ${e.message || ''}`);
  }
}

function classifica(titolo, voci, quanti = 8) {
  if (!voci.length) return '';
  const max = voci[0].conto || 1;
  return `<div class="card"><h3 style="margin-bottom:14px">${esc(titolo)}</h3>${
    voci.slice(0, quanti).map((v) => `
      <div class="bar"><div class="bar-head"><span class="bar-name">${esc(v.nome)}</span><span class="bar-count">${v.conto}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((v.conto / max) * 100)}%"></div></div></div>`).join('')}</div>`;
}

/* ================================================================ UTENTI == */

function initUtenti() { renderUtenti(); }

async function renderUtenti() {
  const cont = $('#utenti-lista');
  loader(cont, 'Carico gli utenti…');
  try {
    const utenti = await getUtenti();
    if (!utenti.length) { vuoto(cont, 'Nessun utente registrato'); return; }
    cont.innerHTML = utenti.map((u) => `
      <div class="card">
        <div class="li-head">
          <span class="li-title">${esc(u.nome || u.email)}</span>
          <span class="badge badge-role">${u.ruolo === 'responsabile' ? 'Responsabile' : 'Operaio'}</span>
        </div>
        <p class="li-row">${esc(u.email || '')}</p>
        ${u.attivo === false ? '<p class="li-row" style="color:var(--danger)">Account disattivato</p>' : ''}
        ${u.uid === me.uid ? '<p style="color:var(--text-light);font-size:12px;margin-top:10px">Questo sei tu.</p>' : `
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" data-ruolo="${esc(u.uid)}" data-nuovo="${u.ruolo === 'responsabile' ? 'operaio' : 'responsabile'}">
            ${u.ruolo === 'responsabile' ? 'Rendi operaio' : 'Rendi responsabile'}</button>
          <button class="btn ${u.attivo === false ? 'btn-soft' : 'btn-red'} btn-sm" data-attivo="${esc(u.uid)}" data-val="${u.attivo === false ? 'true' : 'false'}">
            ${u.attivo === false ? 'Riattiva' : 'Disattiva'}</button>
        </div>`}
      </div>`).join('');

    cont.querySelectorAll('[data-ruolo]').forEach((b) => b.addEventListener('click', async () => {
      const ok = await conferma({ titolo: 'Cambiare il ruolo?',
        messaggio: b.dataset.nuovo === 'responsabile'
          ? 'L’utente potrà vedere tutti i report, gestire anagrafiche, qualifiche e altri accessi.'
          : 'L’utente perderà l’accesso alle sezioni da responsabile.',
        testoOk: 'Cambia ruolo' });
      if (!ok) return;
      try { await aggiornaUtente(b.dataset.ruolo, { ruolo: b.dataset.nuovo }); toast('Ruolo aggiornato.'); renderUtenti(); }
      catch (e) { toast(messaggioErrore(e), 'danger'); }
    }));

    cont.querySelectorAll('[data-attivo]').forEach((b) => b.addEventListener('click', async () => {
      const attiva = b.dataset.val === 'true';
      const ok = await conferma({ titolo: attiva ? 'Riattivare l’account?' : 'Disattivare l’account?',
        messaggio: attiva ? 'L’utente potrà nuovamente accedere.' : 'L’utente non potrà più accedere. I report restano archiviati.',
        testoOk: attiva ? 'Riattiva' : 'Disattiva', pericolo: !attiva });
      if (!ok) return;
      try { await aggiornaUtente(b.dataset.attivo, { attivo: attiva }); toast(attiva ? 'Account riattivato.' : 'Account disattivato.'); renderUtenti(); }
      catch (e) { toast(messaggioErrore(e), 'danger'); }
    }));
  } catch (e) {
    console.error(e);
    erroreBox(cont, `Impossibile caricare gli utenti. ${e.message || ''}`);
  }
}

async function creaUtenteDialog() {
  // collega opzionale a un dipendente
  if (!anagrafiche.dipendenti.length) await caricaAnagrafiche();

  const val = await form({ titolo: 'Nuovo accesso', testoOk: 'Crea accesso', campi: [
    { name: 'nome', label: 'Nome e cognome', required: true, placeholder: 'Mario Rossi' },
    { name: 'email', label: 'Email', type: 'email', required: true, inputmode: 'email', placeholder: 'mario.rossi@molinaro.it' },
    { name: 'password', label: 'Password provvisoria', required: true, placeholder: 'almeno 6 caratteri',
      hint: 'Comunicala all’interessato: potrà cambiarla dal link «Ho dimenticato la password».' },
    { name: 'ruolo', label: 'Ruolo', type: 'select', value: 'operaio', options: [
      { value: 'operaio', label: 'Operaio — compila i report' },
      { value: 'responsabile', label: 'Responsabile — accesso completo' }
    ] }
  ] });
  if (!val) return;

  if (val.password.length < 6) { toast('La password deve avere almeno 6 caratteri.', 'danger'); return; }

  try {
    await creaUtente({ nome: val.nome, email: val.email, password: val.password, ruolo: val.ruolo, dipendenteId: '' }, firebaseConfig);
    toast(`Accesso creato per ${val.nome}.`);
    renderUtenti();
  } catch (e) {
    toast(messaggioErrore(e), 'danger', 5000);
  }
}

/* ================================================================ util ==== */

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
