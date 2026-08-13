/* ==========================================================================
   store.js — Accesso ai dati Firestore (progetto Cantieri, autonomo)
   ========================================================================== */

import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db, COL } from './firebase.js';

const ord = (a, b) => (a || '').localeCompare(b || '', 'it', { sensitivity: 'base' });

/* ============================================================ ANAGRAFICHE == */
/* cantieri, dipendenti e mezzi: gestiti dal responsabile in questo progetto */

async function elenco(nomeCol, mappaSub) {
  const snap = await getDocs(collection(db, nomeCol));
  return snap.docs
    .map((d) => {
      const dati = d.data();
      return {
        id: d.id,
        nome: (dati.nome || '').trim() || '(senza nome)',
        sub: mappaSub ? mappaSub(dati) : '',
        attivo: dati.attivo !== false,
        raw: dati
      };
    })
    .filter((x) => x.attivo)
    .sort((a, b) => ord(a.nome, b.nome));
}

export const getCantieri   = () => elenco(COL.cantieri,   (d) => d.indirizzo || d.committente || d.comune || '');
export const getDipendenti = () => elenco(COL.dipendenti, (d) => d.mansione || d.ruolo || '');
export const getMezzi      = () => elenco(COL.mezzi,      (d) => d.targa || d.tipo || '');

export async function getAnagrafiche() {
  const [cantieri, dipendenti, mezzi] = await Promise.all([getCantieri(), getDipendenti(), getMezzi()]);
  return { cantieri, dipendenti, mezzi };
}

export function creaVoce(tipo, dati) {
  const nomeCol = COL[tipo];
  return addDoc(collection(db, nomeCol), { ...dati, attivo: true, creatoIl: serverTimestamp() });
}
export function aggiornaVoce(tipo, id, dati) {
  return updateDoc(doc(db, COL[tipo], id), dati);
}
/* "Elimina" = disattiva: lo storico dei report che citano la voce resta leggibile */
export function disattivaVoce(tipo, id) {
  return updateDoc(doc(db, COL[tipo], id), { attivo: false });
}

/* ================================================================ REPORT === */

export async function creaReport(dati, autore) {
  return addDoc(collection(db, COL.report), {
    data:         dati.data,
    cantiereId:   dati.cantiereId,
    cantiereNome: dati.cantiereNome || '',
    spese:        (dati.spese || '').trim(),
    materiali:    (dati.materiali || '').trim(),
    descrizione:  (dati.descrizione || '').trim(),
    dipendenti:   (dati.dipendenti || []).map(({ id, nome }) => ({ id, nome })),
    mezzi:        (dati.mezzi || []).map(({ id, nome }) => ({ id, nome })),
    creatoDa:     autore.uid,
    creatoDaNome: autore.nome,
    creatoIl:     serverTimestamp(),
    modificatoIl: serverTimestamp(),
    stato:        'inviato'
  });
}

export function aggiornaReport(id, modifiche) {
  return updateDoc(doc(db, COL.report, id), { ...modifiche, modificatoIl: serverTimestamp() });
}

export async function getReport(id) {
  const snap = await getDoc(doc(db, COL.report, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export const eliminaReport = (id) => deleteDoc(doc(db, COL.report, id));
export const approvaReport = (id) => aggiornaReport(id, { stato: 'approvato' });
export const riapriReport  = (id) => aggiornaReport(id, { stato: 'inviato' });

export async function getMieiReport(uid, quanti = 80) {
  const snap = await getDocs(query(
    collection(db, COL.report),
    where('creatoDa', '==', uid),
    orderBy('data', 'desc'),
    limit(quanti)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getReportFiltrati({ cantiereId, dal, al, stato, quanti = 400 } = {}) {
  const vincoli = [collection(db, COL.report)];
  if (cantiereId) vincoli.push(where('cantiereId', '==', cantiereId));
  vincoli.push(orderBy('data', 'desc'), limit(quanti));

  const snap = await getDocs(query(...vincoli));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => {
      if (dal && r.data < dal) return false;
      if (al && r.data > al) return false;
      if (stato && r.stato !== stato) return false;
      return true;
    });
}

/* ============================================================ QUALIFICHE === */

export async function getQualifiche(dipId) {
  const snap = await getDoc(doc(db, COL.qualifiche, dipId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : { id: dipId, dipendenteId: dipId, nome: '', voci: [] };
}

export async function getTutteLeQualifiche() {
  const snap = await getDocs(collection(db, COL.qualifiche));
  const mappa = {};
  snap.docs.forEach((d) => { mappa[d.id] = { id: d.id, ...d.data() }; });
  return mappa;
}

export function salvaQualifiche(dipId, nome, voci) {
  return setDoc(doc(db, COL.qualifiche, dipId), { dipendenteId: dipId, nome, voci, aggiornatoIl: serverTimestamp() }, { merge: true });
}

export async function aggiungiQualifica(dipId, nome, voce, autore) {
  const att = await getQualifiche(dipId);
  const voci = [...(att.voci || []), {
    testo: voce.testo.trim(),
    note: (voce.note || '').trim(),
    assegnataDa: autore?.nome || '',
    assegnataIl: new Date().toISOString()
  }];
  await salvaQualifiche(dipId, nome, voci);
  return voci;
}

export async function rimuoviQualifica(dipId, nome, indice) {
  const att = await getQualifiche(dipId);
  const voci = (att.voci || []).filter((_, i) => i !== indice);
  await salvaQualifiche(dipId, nome, voci);
  return voci;
}

export async function getCatalogo() {
  const snap = await getDocs(collection(db, COL.catalogo));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ord(a.testo, b.testo));
}

export async function aggiungiAlCatalogo(testo) {
  const pulito = (testo || '').trim();
  if (!pulito) return null;
  const cat = await getCatalogo();
  const gia = cat.find((v) => (v.testo || '').toLowerCase() === pulito.toLowerCase());
  if (gia) return gia.id;
  const ref = await addDoc(collection(db, COL.catalogo), { testo: pulito, creatoIl: serverTimestamp() });
  return ref.id;
}

/* ================================================================ UTENTI === */

export async function getUtenti() {
  const snap = await getDocs(collection(db, COL.utenti));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => ord(a.nome, b.nome));
}
export const aggiornaUtente = (uid, m) => updateDoc(doc(db, COL.utenti, uid), m);

/* ============================================================ STATISTICHE == */

export function calcolaStatistiche(report) {
  const perCantiere = {}, perDip = {}, perMezzo = {}, giornate = new Set();

  report.forEach((r) => {
    giornate.add(r.data);
    const c = r.cantiereNome || r.cantiereId || 'Senza cantiere';
    perCantiere[c] = (perCantiere[c] || 0) + 1;
    (r.dipendenti || []).forEach(({ nome }) => { if (nome) perDip[nome] = (perDip[nome] || 0) + 1; });
    (r.mezzi || []).forEach(({ nome }) => { if (nome) perMezzo[nome] = (perMezzo[nome] || 0) + 1; });
  });

  const classifica = (m) => Object.entries(m).map(([nome, conto]) => ({ nome, conto })).sort((a, b) => b.conto - a.conto);

  return {
    totale: report.length,
    giornate: giornate.size,
    daApprovare: report.filter((r) => r.stato !== 'approvato').length,
    cantieriAttivi: Object.keys(perCantiere).length,
    perCantiere: classifica(perCantiere),
    perDipendente: classifica(perDip),
    perMezzo: classifica(perMezzo)
  };
}

/* ================================================================= CSV ==== */

export function reportInCSV(report) {
  const cols = ['Data', 'Cantiere', 'Compilato da', 'Dipendenti', 'Mezzi', 'Spese', 'Materiali', 'Descrizione', 'Stato'];
  const cella = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const righe = report.map((r) => [
    r.data, r.cantiereNome, r.creatoDaNome,
    (r.dipendenti || []).map((d) => d.nome).join(', '),
    (r.mezzi || []).map((m) => m.nome).join(', '),
    r.spese, r.materiali, r.descrizione, r.stato
  ].map(cella).join(';'));
  return '﻿' + [cols.map(cella).join(';'), ...righe].join('\r\n');
}

export function scarica(nomeFile, contenuto, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([contenuto], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeFile;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
