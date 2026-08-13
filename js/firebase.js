/* ==========================================================================
   firebase.js — Configurazione Firebase
   Molinaro ESCo · Cantieri  (progetto AUTONOMO)
   --------------------------------------------------------------------------
   Questo progetto è completamente indipendente: NON legge e NON scrive nulla
   sul progetto "Magazzino Molinaro". Dipendenti, cantieri e mezzi vivono qui,
   gestiti dall'area responsabile di questa stessa app.
   ========================================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* --------------------------------------------------------------------------
   ⚙️  UNICO blocco da compilare: incolla qui la configurazione del NUOVO
   progetto Firebase "Molinaro Cantieri" (Impostazioni progetto → Le tue app →
   app Web → Configurazione SDK).

   Questi valori non sono segreti: identificano il progetto, non autorizzano
   operazioni. La sicurezza dipende dalle regole Firestore (firestore.rules).
   -------------------------------------------------------------------------- */
export const firebaseConfig = {
  apiKey:            'INSERISCI_API_KEY',
  authDomain:        'INSERISCI_PROJECT_ID.firebaseapp.com',
  projectId:         'INSERISCI_PROJECT_ID',
  storageBucket:     'INSERISCI_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'INSERISCI_SENDER_ID',
  appId:             'INSERISCI_APP_ID'
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

/* Sessione persistente: login una volta sola, si resta dentro. */
setPersistence(auth, browserLocalPersistence).catch(() => {});

/* Cache offline: in cantiere il segnale manca spesso. I report compilati
   senza rete vengono accodati e inviati appena il telefono torna online. */
let firestore;
try {
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn('[firebase] cache offline non attivabile:', e);
  firestore = initializeFirestore(app, {});
}

export const db = firestore;

/* Nomi delle collection, centralizzati. */
export const COL = {
  utenti:     'utenti',
  dipendenti: 'dipendenti',
  cantieri:   'cantieri',
  mezzi:      'mezzi',
  report:     'report',
  qualifiche: 'qualifiche',
  catalogo:   'catalogo_qualifiche'
};
