// La sessione va persistita fra i caricamenti di pagina, come fa il vero SDK.
const CHIAVE = (nome) => `__finto_auth__:${nome}`;
const stati = {
  get: (nome) => { try { return JSON.parse(localStorage.getItem(CHIAVE(nome))); } catch { return null; } },
  set: (nome, u) => localStorage.setItem(CHIAVE(nome), JSON.stringify(u)),
  delete: (nome) => localStorage.removeItem(CHIAVE(nome))
};
const ascoltatori = new Map();    // nomeApp -> [cb]

export function getAuth(app) {
  const nome = app.name;
  if (!ascoltatori.has(nome)) ascoltatori.set(nome, []);
  return { appName: nome, get currentUser() { return stati.get(nome) || null; } };
}

function notifica(nome) {
  (ascoltatori.get(nome) || []).forEach((cb) => cb(stati.get(nome) || null));
}

export const browserLocalPersistence = 'local';
export function setPersistence() { return Promise.resolve(); }

export function onAuthStateChanged(auth, cb) {
  ascoltatori.get(auth.appName).push(cb);
  setTimeout(() => cb(stati.get(auth.appName) || null), 0);
  return () => {};
}

export function signInWithEmailAndPassword(auth, email, password) {
  const conto = globalThis.__FINTO__.utenti[email];
  if (!conto || conto.password !== password) {
    return Promise.reject({ code: 'auth/invalid-credential' });
  }
  const utente = { uid: conto.uid, email, isAnonymous: false };
  stati.set(auth.appName, utente);
  notifica(auth.appName);
  return Promise.resolve({ user: utente });
}

export function createUserWithEmailAndPassword(auth, email, password) {
  if (globalThis.__FINTO__.utenti[email]) {
    return Promise.reject({ code: 'auth/email-already-in-use' });
  }
  const uid = 'uid-' + Math.random().toString(36).slice(2, 9);
  globalThis.__FINTO__.utenti[email] = { uid, password };
  return Promise.resolve({ user: { uid, email } });
}

export function signInAnonymously(auth) {
  const utente = { uid: 'anon-1', isAnonymous: true };
  stati.set(auth.appName, utente);
  notifica(auth.appName);
  return Promise.resolve({ user: utente });
}

export function signOut(auth) {
  stati.delete(auth.appName);
  notifica(auth.appName);
  return Promise.resolve();
}

export function sendPasswordResetEmail() { return Promise.resolve(); }
