// Finto SDK per i test: NON fa parte del progetto.
const apps = {};
export function initializeApp(config, nome = '[DEFAULT]') {
  apps[nome] = { name: nome, options: config };
  return apps[nome];
}
export function deleteApp(app) { delete apps[app.name]; return Promise.resolve(); }
