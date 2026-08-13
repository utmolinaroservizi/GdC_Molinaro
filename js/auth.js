/* ==========================================================================
   auth.js — Autenticazione, profilo e creazione utenti
   ========================================================================== */

import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { auth, db, COL } from './firebase.js';

let profilo = null;
export const profiloCorrente = () => profilo;
export const isResp = () => profilo?.ruolo === 'responsabile';

/* --------------------------------------------------------------- accesso -- */

export const accedi = (email, pw) => signInWithEmailAndPassword(auth, email.trim(), pw);
export async function esci() { profilo = null; await signOut(auth); }
export const reimpostaPassword = (email) => sendPasswordResetEmail(auth, email.trim());

export async function caricaProfilo(utente) {
  const snap = await getDoc(doc(db, COL.utenti, utente.uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  profilo = {
    uid: utente.uid,
    email: d.email || utente.email || '',
    nome: d.nome || (utente.email || 'Utente').split('@')[0],
    ruolo: d.ruolo || 'operaio',
    dipendenteId: d.dipendenteId || '',
    attivo: d.attivo !== false
  };
  return profilo;
}

/**
 * Osserva lo stato d'accesso. Richiama `cb(profilo|null)`.
 * Usata dalla shell dell'app per decidere cosa mostrare.
 */
export function osservaAccesso(cb) {
  onAuthStateChanged(auth, async (utente) => {
    if (!utente || utente.isAnonymous) { profilo = null; cb(null); return; }
    try {
      const p = (profilo && profilo.uid === utente.uid) ? profilo : await caricaProfilo(utente);
      if (!p) { await signOut(auth); cb(null, 'nonregistrato'); return; }
      if (!p.attivo) { await signOut(auth); cb(null, 'disattivato'); return; }
      cb(p);
    } catch (e) {
      console.error('[auth]', e);
      cb(null, 'errore');
    }
  });
}

/* -------------------------------------------------- creazione di utenti --- */
/* Usa un'app Firebase temporanea così la sessione del responsabile resta viva */

export async function creaUtente({ email, password, nome, ruolo, dipendenteId }, config) {
  const tmp = initializeApp(config, `crea-${Date.now()}`);
  try {
    const authTmp = getAuth(tmp);
    const cred = await createUserWithEmailAndPassword(authTmp, email.trim(), password);
    const uid = cred.user.uid;
    await signOut(authTmp);

    // scritto dall'istanza principale = coi permessi del responsabile
    await setDoc(doc(db, COL.utenti, uid), {
      email: email.trim(),
      nome: nome.trim(),
      ruolo: ruolo === 'responsabile' ? 'responsabile' : 'operaio',
      dipendenteId: dipendenteId || '',
      attivo: true,
      creatoIl: serverTimestamp(),
      creatoDa: profilo?.uid || ''
    });
    return uid;
  } finally {
    await deleteApp(tmp).catch(() => {});
  }
}

/* ------------------------------------------------------------- messaggi --- */

export function messaggioErrore(e) {
  switch (e?.code) {
    case 'auth/invalid-email':          return 'Indirizzo email non valido.';
    case 'auth/user-disabled':          return 'Account disattivato. Contatta il responsabile.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':     return 'Email o password non corretti.';
    case 'auth/too-many-requests':      return 'Troppi tentativi. Riprova tra qualche minuto.';
    case 'auth/network-request-failed': return 'Nessuna connessione. Verifica la rete.';
    case 'auth/email-already-in-use':   return 'Esiste già un account con questa email.';
    case 'auth/weak-password':          return 'La password deve avere almeno 6 caratteri.';
    case 'auth/operation-not-allowed':  return 'Accesso email/password non abilitato su Firebase.';
    case 'permission-denied':           return 'Permessi insufficienti per questa operazione.';
    case 'unavailable':                 return 'Servizio non raggiungibile. Controlla la connessione.';
    default: return e?.message || 'Si è verificato un errore imprevisto.';
  }
}
