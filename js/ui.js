/* ==========================================================================
   ui.js — Utilità d'interfaccia: toast, modali, selettori, date.
   Stile allineato alla WebApp Magazzino (bottom-sheet, tema chiaro).
   ========================================================================== */

export const $  = (sel, r = document) => r.querySelector(sel);
export const $$ = (sel, r = document) => [...r.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------------------------------------------------------------- toast --- */

let toastEl = null, toastT = null;
export function toast(msg, tipo = 'ok', durata = 3200) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  clearTimeout(toastT);
  toastEl.className = `toast toast-${tipo}`;
  toastEl.textContent = msg;
  // reflow per riattivare la transizione
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  toastT = setTimeout(() => toastEl.classList.remove('show'), durata);
}

/* ------------------------------------------------------------- iniziali --- */

export function iniziali(nome) {
  return String(nome || '?').split(' ').map((w) => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

/* ---------------------------------------------------------------- date ---- */

export function oggiISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function dataIT(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const [a, m, g] = iso.split('-');
  return g && m && a ? `${g}/${m}/${a}` : iso;
}
export function dataEstesa(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function istanteIT(ts) {
  if (!ts) return '';
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? ''
    : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ------------------------------------------------------------- stati ----- */

export function loader(cont, testo = 'Caricamento…') {
  cont.innerHTML = `<div class="loader"><div class="loading-spinner"></div><span>${esc(testo)}</span></div>`;
}
export function vuoto(cont, titolo, dettaglio = '') {
  cont.innerHTML = `<div class="empty"><strong>${esc(titolo)}</strong>${dettaglio ? `<p>${esc(dettaglio)}</p>` : ''}</div>`;
}
export function erroreBox(cont, msg) {
  cont.innerHTML = `<div class="notice notice-danger">${esc(msg)}</div>`;
}

/* ------------------------------------------------------- infrastruttura --- */

const ICON_X = '&times;';

function montaModale(html, { center = false } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop open' + (center ? ' center' : '');
  back.innerHTML = `<div class="modal-sheet">${html}</div>`;
  document.body.appendChild(back);
  document.body.style.overflow = 'hidden';
  const chiudi = () => { back.remove(); document.body.style.overflow = ''; };
  back.addEventListener('click', (e) => { if (e.target === back) chiudi(); });
  return { back, chiudi };
}

/* --------------------------------------------------- selettore da elenco -- */

/**
 * Bottom-sheet di selezione con ricerca.
 * @returns {Promise<Array|null>} elementi scelti, o null se annullato
 */
export function scegli({ titolo, elementi, selezionati = [], multiplo = true }) {
  return new Promise((risolvi) => {
    const scelti = new Set(selezionati);

    const { back, chiudi: chiudiBase } = montaModale(`
      <div class="modal-handle"></div>
      <div class="modal-top">
        <span class="modal-title">${esc(titolo)}</span>
        <button class="modal-close" type="button" aria-label="Chiudi">${ICON_X}</button>
      </div>
      <div class="modal-search">
        <input type="search" placeholder="Cerca…" autocomplete="off" aria-label="Cerca">
      </div>
      <div class="modal-body"></div>
      ${multiplo ? `<div class="modal-foot">
        <button class="btn btn-green" data-a="ok">Conferma</button>
        <button class="btn btn-outline" data-a="no">Annulla</button>
      </div>` : ''}
    `);

    const body = $('.modal-body', back);
    const ricerca = $('input[type="search"]', back);

    const chiudi = (r) => { document.removeEventListener('keydown', onKey); chiudiBase(); risolvi(r); };
    const onKey = (e) => { if (e.key === 'Escape') chiudi(null); };
    document.addEventListener('keydown', onKey);

    function disegna(filtro = '') {
      const t = filtro.trim().toLowerCase();
      const vis = t ? elementi.filter((e) => `${e.nome} ${e.sub || ''}`.toLowerCase().includes(t)) : elementi;
      if (!vis.length) { vuoto(body, 'Nessun risultato', t ? 'Prova un altro termine.' : 'Elenco vuoto.'); return; }
      body.innerHTML = vis.map((e) => `
        <button type="button" class="pick${scelti.has(e.id) ? ' on' : ''}" data-id="${esc(e.id)}">
          ${multiplo ? '<span class="pick-check" aria-hidden="true">✓</span>' : ''}
          <span class="pick-info">
            <span class="pick-name">${esc(e.nome)}</span>
            ${e.sub ? `<span class="pick-sub">${esc(e.sub)}</span>` : ''}
          </span>
        </button>`).join('');
    }

    body.addEventListener('click', (e) => {
      const riga = e.target.closest('.pick');
      if (!riga) return;
      const id = riga.dataset.id;
      if (!multiplo) { chiudi(elementi.filter((x) => x.id === id)); return; }
      if (scelti.has(id)) scelti.delete(id); else scelti.add(id);
      riga.classList.toggle('on', scelti.has(id));
    });

    ricerca.addEventListener('input', () => disegna(ricerca.value));
    $('.modal-close', back).addEventListener('click', () => chiudi(null));
    if (multiplo) {
      $('[data-a="ok"]', back).addEventListener('click', () => chiudi(elementi.filter((e) => scelti.has(e.id))));
      $('[data-a="no"]', back).addEventListener('click', () => chiudi(null));
    }

    disegna();
    if (window.matchMedia('(min-width:720px)').matches) ricerca.focus();
  });
}

/* -------------------------------------------------------------- conferma -- */

export function conferma({ titolo, messaggio, testoOk = 'Conferma', pericolo = false }) {
  return new Promise((risolvi) => {
    const { back, chiudi } = montaModale(`
      <div class="modal-top"><span class="modal-title">${esc(titolo)}</span></div>
      <div class="modal-body"><p style="color:var(--text-muted);font-size:14px;line-height:1.55;margin:4px 2px">${esc(messaggio)}</p></div>
      <div class="modal-foot">
        <button class="btn ${pericolo ? 'btn-red' : 'btn-green'}" data-a="ok">${esc(testoOk)}</button>
        <button class="btn btn-outline" data-a="no">Annulla</button>
      </div>`, { center: true });
    $('[data-a="ok"]', back).addEventListener('click', () => { chiudi(); risolvi(true); });
    $('[data-a="no"]', back).addEventListener('click', () => { chiudi(); risolvi(false); });
  });
}

/* ------------------------------------------------- form generico a campi -- */

/**
 * Modale con campi di testo/select. `campi`: [{name,label,type,value,placeholder,hint,required,options}]
 * @returns {Promise<object|null>} valori {name: value} o null
 */
export function form({ titolo, campi, testoOk = 'Salva' }) {
  return new Promise((risolvi) => {
    const corpo = campi.map((c) => {
      if (c.type === 'select') {
        return `<div class="form-group">
          <label>${esc(c.label)}</label>
          <select name="${esc(c.name)}">${(c.options || []).map((o) =>
            `<option value="${esc(o.value)}"${o.value === c.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
          ${c.hint ? `<span class="form-hint">${esc(c.hint)}</span>` : ''}
        </div>`;
      }
      if (c.type === 'textarea') {
        return `<div class="form-group">
          <label>${esc(c.label)}</label>
          <textarea name="${esc(c.name)}" placeholder="${esc(c.placeholder || '')}">${esc(c.value || '')}</textarea>
          ${c.hint ? `<span class="form-hint">${esc(c.hint)}</span>` : ''}
        </div>`;
      }
      return `<div class="form-group">
        <label>${esc(c.label)}</label>
        <input type="${esc(c.type || 'text')}" name="${esc(c.name)}" value="${esc(c.value || '')}"
               placeholder="${esc(c.placeholder || '')}" autocomplete="off"${c.inputmode ? ` inputmode="${esc(c.inputmode)}"` : ''}>
        ${c.hint ? `<span class="form-hint">${esc(c.hint)}</span>` : ''}
      </div>`;
    }).join('');

    const { back, chiudi } = montaModale(`
      <div class="modal-top">
        <span class="modal-title">${esc(titolo)}</span>
        <button class="modal-close" type="button" aria-label="Chiudi">${ICON_X}</button>
      </div>
      <div class="modal-body">${corpo}<div data-err></div></div>
      <div class="modal-foot">
        <button class="btn btn-green" data-a="ok">${esc(testoOk)}</button>
        <button class="btn btn-outline" data-a="no">Annulla</button>
      </div>`, { center: true });

    const leggi = () => {
      const out = {};
      campi.forEach((c) => { out[c.name] = ($(`[name="${c.name}"]`, back)?.value || '').trim(); });
      return out;
    };

    const conferma = () => {
      const val = leggi();
      const mancano = campi.filter((c) => c.required && !val[c.name]);
      if (mancano.length) {
        $('[data-err]', back).innerHTML =
          `<div class="notice notice-danger">Compila: ${mancano.map((c) => esc(c.label.toLowerCase())).join(', ')}.</div>`;
        return;
      }
      chiudi(); risolvi(val);
    };

    $('[data-a="ok"]', back).addEventListener('click', conferma);
    $('[data-a="no"]', back).addEventListener('click', () => { chiudi(); risolvi(null); });
    $('.modal-close', back).addEventListener('click', () => { chiudi(); risolvi(null); });
    const primo = $('input,textarea,select', back);
    if (primo && window.matchMedia('(min-width:720px)').matches) primo.focus();
  });
}

/* --------------------------------------------- bottom-sheet di dettaglio -- */

/** Apre un bottom-sheet con contenuto HTML e pulsanti d'azione.
 *  azioni: [{label,tipo,onClick}] — onClick riceve `chiudi`. */
export function sheet({ titolo, html, azioni = [] }) {
  const { back, chiudi } = montaModale(`
    <div class="modal-handle"></div>
    <div class="modal-top">
      <span class="modal-title">${esc(titolo)}</span>
      <button class="modal-close" type="button" aria-label="Chiudi">${ICON_X}</button>
    </div>
    <div class="modal-body">${html}</div>
    ${azioni.length ? `<div class="modal-foot">${azioni.map((a, i) =>
      `<button class="btn ${a.tipo || 'btn-outline'}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
  `);
  $('.modal-close', back).addEventListener('click', chiudi);
  azioni.forEach((a, i) => $(`[data-i="${i}"]`, back)?.addEventListener('click', () => a.onClick(chiudi)));
  return { chiudi };
}

/* --------------------------------------------------------- barra offline -- */

export function sorveglianzaRete(barId = 'offline-bar') {
  const bar = document.getElementById(barId);
  if (!bar) return;
  bar.innerHTML = '<div class="notice notice-warn">Nessuna connessione. Puoi continuare: i report partono appena torna la rete.</div>';
  const agg = () => bar.classList.toggle('show', !navigator.onLine);
  window.addEventListener('online', agg);
  window.addEventListener('offline', agg);
  agg();
}
