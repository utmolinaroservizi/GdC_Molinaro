// Finto Firestore in memoria. I dati stanno in globalThis.__FINTO__.db[app][coll]
const D = () => globalThis.__FINTO__.db;
// Persistenza fra i caricamenti di pagina: serve solo al banco di prova.
const salva = () => {
  try { localStorage.setItem('__finto_db__', JSON.stringify(globalThis.__FINTO__.db)); }
  catch { /* ignora */ }
};

export function getFirestore(app) { return { appName: app.name }; }
export function initializeFirestore(app) { return { appName: app.name }; }
export function persistentLocalCache() { return {}; }
export function persistentMultipleTabManager() { return {}; }
export function serverTimestamp() { return new Date(); }

export function collection(db, nome) { return { tipo: 'coll', app: db.appName, nome }; }
export function doc(db, nome, id) {
  if (db && db.tipo === 'coll') return { tipo: 'doc', app: db.app, nome: db.nome, id: nome };
  return { tipo: 'doc', app: db.appName, nome, id };
}
export function query(base, ...vincoli) { return { ...base, vincoli }; }
export function where(campo, op, valore) { return { k: 'where', campo, op, valore }; }
export function orderBy(campo, dir = 'asc') { return { k: 'order', campo, dir }; }
export function limit(n) { return { k: 'limit', n }; }

function tabella(app, nome) {
  D()[app] = D()[app] || {};
  D()[app][nome] = D()[app][nome] || {};
  return D()[app][nome];
}

export function getDocs(q) {
  const t = tabella(q.app, q.nome);
  let righe = Object.entries(t).map(([id, dati]) => ({ id, dati }));

  (q.vincoli || []).forEach((v) => {
    if (v.k === 'where' && v.op === '==') righe = righe.filter((r) => r.dati[v.campo] === v.valore);
    if (v.k === 'order') righe.sort((a, b) => {
      const x = a.dati[v.campo], y = b.dati[v.campo];
      return (x > y ? 1 : x < y ? -1 : 0) * (v.dir === 'desc' ? -1 : 1);
    });
    if (v.k === 'limit') righe = righe.slice(0, v.n);
  });

  return Promise.resolve({
    empty: righe.length === 0,
    size: righe.length,
    docs: righe.map((r) => ({ id: r.id, data: () => r.dati, exists: () => true }))
  });
}

export function getDoc(ref) {
  const dati = tabella(ref.app, ref.nome)[ref.id];
  return Promise.resolve({
    id: ref.id, exists: () => Boolean(dati), data: () => dati
  });
}

export function addDoc(coll, dati) {
  const id = 'doc-' + Math.random().toString(36).slice(2, 9);
  tabella(coll.app, coll.nome)[id] = { ...dati };
  salva();
  return Promise.resolve({ id });
}

export function setDoc(ref, dati, opzioni) {
  const t = tabella(ref.app, ref.nome);
  t[ref.id] = opzioni?.merge ? { ...(t[ref.id] || {}), ...dati } : { ...dati };
  salva();
  return Promise.resolve();
}

export function updateDoc(ref, dati) {
  const t = tabella(ref.app, ref.nome);
  if (!t[ref.id]) return Promise.reject({ code: 'not-found' });
  t[ref.id] = { ...t[ref.id], ...dati };
  salva();
  return Promise.resolve();
}

export function deleteDoc(ref) {
  delete tabella(ref.app, ref.nome)[ref.id];
  salva();
  return Promise.resolve();
}
