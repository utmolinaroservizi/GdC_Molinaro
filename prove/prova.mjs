import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const BASE=process.env.BASE||'http://localhost:8000';
const FINTO=new URL('./finto-firebase',import.meta.url).pathname;
const SEED={
  utenti:{
    'capo@molinaro.it':{uid:'u-capo',password:'password123'},
    'mario@molinaro.it':{uid:'u-mario',password:'operaio123'}
  },
  db:{'[DEFAULT]':{
    utenti:{
      'u-capo':{email:'capo@molinaro.it',nome:'Luigi Capo',ruolo:'responsabile',attivo:true},
      'u-mario':{email:'mario@molinaro.it',nome:'Mario Rossi',ruolo:'operaio',attivo:true,dipendenteId:'d1'}
    },
    cantieri:{c1:{nome:'Scuola Media Cosenza',indirizzo:'Via Roma 12',attivo:true},
              c2:{nome:'Impianto FV Rende',indirizzo:'Zona Ind.',attivo:true}},
    dipendenti:{d1:{nome:'Mario Rossi',mansione:'Operaio specializzato',attivo:true},
                d2:{nome:'Luca Bianchi',mansione:'Elettricista',attivo:true}},
    mezzi:{m1:{nome:'Escavatore CAT 320',targa:'AB123CD',attivo:true},
           m2:{nome:'Furgone Ducato',targa:'EF456GH',attivo:true}},
    report:{},
    qualifiche:{},
    catalogo_qualifiche:{q1:{testo:'Conduzione macchine operatrici'}}
  }}
};

const esiti=[]; const V=(n,ok,nota='')=>{esiti.push({n,ok});console.log(`${ok?'✓':'✗'} ${n}${nota?' — '+nota:''}`);};
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});

async function ctxNuovo(extra){
  const ctx=await browser.newContext({viewport:{width:412,height:915}});
  await ctx.addInitScript(({seed,extraStr})=>{
    let db=null; try{db=JSON.parse(localStorage.getItem('__finto_db__'));}catch{}
    globalThis.__FINTO__={utenti:seed.utenti,db:db||seed.db};
    if(!db)localStorage.setItem('__finto_db__',JSON.stringify(seed.db));
    if(extraStr){const fn=new Function('return '+extraStr)();fn();localStorage.setItem('__finto_db__',JSON.stringify(globalThis.__FINTO__.db));}
  },{seed:JSON.parse(JSON.stringify(SEED)),extraStr:extra||''});
  await ctx.route('**/firebasejs/**',r=>{
    const file=r.request().url().split('/').pop();
    r.fulfill({status:200,contentType:'application/javascript',body:readFileSync(`${FINTO}/${file}`,'utf8')});
  });
  // font google: stub per non dipendere dalla rete
  await ctx.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  return ctx;
}
const login=async(page,email,pw)=>{
  await page.goto(`${BASE}/index.html`);
  await page.waitForSelector('#login-btn');
  await page.fill('#login-email',email); await page.fill('#login-password',pw);
  await page.click('#login-btn');
  await page.waitForURL('**/app.html',{timeout:9000});
  await page.waitForSelector('#loading-screen',{state:'hidden',timeout:9000});
};

/* 1. LOGIN OPERAIO */
{
  const ctx=await ctxNuovo(); const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await login(page,'mario@molinaro.it','operaio123');
  V('Login operaio → app',true);
  V('Nessun errore JS al boot',errs.length===0,errs[0]||'');
  V('Saluto personalizzato',(await page.textContent('#home-title')).includes('Mario'));
  V('Nav responsabile nascosta all\'operaio',
    await page.locator('#nav-anag').evaluate(e=>e.classList.contains('hidden')));
  await ctx.close();
}

/* 2. OPERAIO INVIA REPORT */
{
  const ctx=await ctxNuovo(); const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await login(page,'mario@molinaro.it','operaio123');
  await page.click('#nav-nuovo');
  await page.waitForSelector('#page-nuovo.active');

  await page.click('#btn-invia');
  V('Invio senza cantiere bloccato',(await page.textContent('#nuovo-err')).includes('cantiere'));

  await page.click('#pick-cantiere');
  await page.waitForSelector('.modal-backdrop .pick');
  V('Modale cantieri popolata',(await page.locator('.modal-backdrop .pick').count())===2);
  await page.locator('.modal-backdrop .pick',{hasText:'Scuola Media'}).click();
  await page.waitForSelector('.modal-backdrop',{state:'detached'});
  V('Cantiere selezionato mostrato',(await page.textContent('#v-cantiere')).includes('Scuola Media'));

  await page.click('#pick-dipendenti');
  await page.waitForSelector('.modal-backdrop .pick');
  await page.locator('.modal-backdrop .pick').nth(0).click();
  await page.locator('.modal-backdrop .pick').nth(1).click();
  await page.click('.modal-backdrop [data-a="ok"]');
  await page.waitForSelector('.modal-backdrop',{state:'detached'});
  V('Due dipendenti → due chip',(await page.locator('#chip-dipendenti .chip').count())===2);

  await page.click('#pick-mezzi');
  await page.waitForSelector('.modal-backdrop .pick');
  await page.locator('.modal-backdrop .pick',{hasText:'Escavatore'}).click();
  await page.click('.modal-backdrop [data-a="ok"]');
  await page.waitForSelector('.modal-backdrop',{state:'detached'});

  await page.fill('#f-spese','Gasolio 60 euro');
  await page.fill('#f-materiali','20 sacchi cemento');
  await page.fill('#f-descrizione','Scavo di sbancamento e posa cavidotti.');

  const bozza=await page.evaluate(()=>localStorage.getItem('molinaro:cantieri:bozza:u-mario'));
  V('Bozza salvata',Boolean(bozza&&bozza.includes('cemento')));

  await page.click('#btn-invia');
  await page.waitForSelector('#page-report.active',{timeout:9000});
  const rep=await page.evaluate(()=>Object.values(globalThis.__FINTO__.db['[DEFAULT]'].report));
  V('Report scritto su Firestore',rep.length===1);
  V('Nome cantiere denormalizzato',rep[0]?.cantiereNome==='Scuola Media Cosenza');
  V('Squadra+mezzi con nome',rep[0]?.dipendenti?.length===2&&rep[0]?.mezzi?.[0]?.nome?.includes('Escavatore'));
  V('Autore e stato',rep[0]?.creatoDa==='u-mario'&&rep[0]?.stato==='inviato');
  V('Bozza ripulita',(await page.evaluate(()=>localStorage.getItem('molinaro:cantieri:bozza:u-mario')))===null);
  await page.waitForSelector('.list-item');
  V('Report visibile in lista',(await page.textContent('#report-lista')).includes('Scuola Media'));
  V('Nessun errore JS nel flusso',errs.length===0,errs[0]||'');
  await ctx.close();
}

/* 3. RESPONSABILE: nav, approva, anagrafiche, qualifiche, stat */
{
  const seedReport=`function(){globalThis.__FINTO__.db['[DEFAULT]'].report={r1:{data:'2026-08-12',cantiereId:'c1',cantiereNome:'Scuola Media Cosenza',spese:'Gasolio',materiali:'Cemento',descrizione:'Scavo e posa',dipendenti:[{id:'d1',nome:'Mario Rossi'}],mezzi:[{id:'m1',nome:'Escavatore CAT 320'}],creatoDa:'u-mario',creatoDaNome:'Mario Rossi',stato:'inviato'}};}`;
  const ctx=await ctxNuovo(seedReport); const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await login(page,'capo@molinaro.it','password123');
  V('Nav responsabile visibile',
    !(await page.locator('#nav-anag').evaluate(e=>e.classList.contains('hidden'))));
  V('Hamburger visibile',await page.locator('#hamburger-btn').isVisible());

  // report tutti + approva
  await page.click('#nav-report'); await page.waitForSelector('#page-report.active');
  await page.waitForSelector('.list-item');
  V('Responsabile vede report altrui',(await page.textContent('#report-lista')).includes('Mario Rossi'));
  await page.click('.list-item'); await page.waitForSelector('.modal-backdrop');
  V('Dettaglio completo',(await page.textContent('.modal-body')).includes('Escavatore CAT 320'));
  await page.click('.modal-foot [class*="btn-green"]');
  await page.waitForTimeout(600);
  V('Approvazione report',await page.evaluate(()=>globalThis.__FINTO__.db['[DEFAULT]'].report.r1.stato)==='approvato');

  // anagrafiche: aggiungi cantiere
  await page.click('#nav-anag'); await page.waitForSelector('#page-anag.active');
  await page.waitForSelector('.data-row');
  V('Elenco cantieri in anagrafiche',(await page.textContent('#anag-body')).includes('Impianto FV Rende'));
  await page.click('#fab');
  await page.waitForSelector('.modal-backdrop input[name="nome"]');
  await page.fill('.modal-backdrop input[name="nome"]','Nuovo Cantiere Test');
  await page.fill('.modal-backdrop input[name="sub"]','Via Test 1');
  await page.click('.modal-backdrop [data-a="ok"]');
  await page.waitForTimeout(700);
  const cant=await page.evaluate(()=>Object.values(globalThis.__FINTO__.db['[DEFAULT]'].cantieri));
  V('Cantiere creato su Firestore',cant.some(c=>c.nome==='Nuovo Cantiere Test'&&c.attivo===true));

  // dipendenti + qualifica
  await page.click('#anag-tabs [data-anag="dipendenti"]');
  await page.waitForSelector('[data-qadd]');
  V('Dipendenti elencati',(await page.textContent('#anag-body')).includes('Luca Bianchi'));
  await page.locator('[data-qadd]').first().click();
  await page.waitForSelector('.modal-backdrop .pick');
  await page.locator('.modal-backdrop .pick',{hasText:'Conduzione macchine'}).click();
  await page.waitForTimeout(700);
  const q=await page.evaluate(()=>globalThis.__FINTO__.db['[DEFAULT]'].qualifiche);
  const voce=Object.values(q)[0];
  V('Qualifica assegnata',voce?.voci?.[0]?.testo==='Conduzione macchine operatrici',voce?.nome||'');
  V('Qualifica con autore',voce?.voci?.[0]?.assegnataDa==='Luigi Capo');

  // statistiche
  await page.click('#nav-stat'); await page.waitForSelector('#page-stat.active');
  await page.selectOption('#stat-periodo','0');
  await page.waitForSelector('#stat-body .stat-val');
  V('Statistiche calcolate',(await page.locator('#stat-body .stat-val').first().textContent())==='1');

  // utenti via hamburger
  await page.click('#hamburger-btn');
  await page.click('.hamburger-menu-item[data-goto="utenti"]');
  await page.waitForSelector('#page-utenti.active');
  await page.waitForSelector('#utenti-lista .card');
  V('Gestione utenti elenca account',(await page.textContent('#utenti-lista')).includes('Luigi Capo'));

  V('Nessun errore JS (responsabile)',errs.length===0,errs[0]||'');
  await ctx.close();
}

await browser.close();
const ko=esiti.filter(e=>!e.ok);
console.log(`\n${esiti.length-ko.length}/${esiti.length} verifiche superate`);
process.exit(ko.length?1:0);
