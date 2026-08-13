/* ==========================================================================
   Dettatura vocale (Web Speech API)
   --------------------------------------------------------------------------
   Pensata per chi non ha dimestichezza con la tastiera del telefono: un solo
   pulsante che alterna "Inizia dettatura" e "Termina dettatura".

   Compatibilità: Chrome su Android e desktop, Edge, Safari da iOS 14.5.
   Richiede HTTPS (GitHub Pages lo garantisce; in locale funziona su
   http://localhost).

   Dove non è supportata, il pulsante viene rimosso in silenzio e resta la
   normale digitazione: nessun messaggio d'errore che confonda l'operaio.
   ========================================================================== */

const Riconoscitore = window.SpeechRecognition || window.webkitSpeechRecognition;

/** @returns {boolean} true se il browser supporta la dettatura. */
export function dettaturaDisponibile() {
  return Boolean(Riconoscitore);
}

const ICONA_MICROFONO = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
  </svg>`;

const ICONA_STOP = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2"/>
  </svg>`;

/* -------------------------------------------------------------------------- */

/**
 * Collega la dettatura a un campo di testo.
 *
 * @param {HTMLButtonElement} bottone  pulsante che avvia e ferma
 * @param {HTMLTextAreaElement|HTMLInputElement} campo  destinazione del testo
 * @param {HTMLElement} [stato]  elemento in cui mostrare "sto ascoltando…"
 * @returns {{ferma: Function, inAscolto: Function}|null}
 */
export function collegaDettatura(bottone, campo, stato) {
  if (!bottone || !campo) return null;

  // Browser senza supporto: via il pulsante, resta la tastiera.
  if (!Riconoscitore) {
    bottone.remove();
    return null;
  }

  const riconoscitore = new Riconoscitore();
  riconoscitore.lang           = 'it-IT';
  riconoscitore.continuous     = true;   // non si ferma alla prima pausa
  riconoscitore.interimResults = true;   // testo provvisorio mentre si parla
  riconoscitore.maxAlternatives = 1;

  let attiva      = false; // l'utente vuole dettare
  let testoBase   = '';    // contenuto del campo prima di iniziare
  let consolidato = '';    // frasi già riconosciute in via definitiva

  /* ------------------------------------------------------------- helper -- */

  function aggiornaCampo(provvisorio = '') {
    const parti = [testoBase, consolidato, provvisorio]
      .map((parte) => parte.trim())
      .filter(Boolean);
    campo.value = parti.join(' ');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function mostraStato(messaggio, visibile) {
    if (!stato) return;
    stato.textContent = messaggio;
    stato.classList.toggle('show', visibile);
  }

  function aspettoAscolto() {
    bottone.classList.add('rec');
    bottone.innerHTML = `${ICONA_STOP}<span>Termina dettatura</span>`;
    bottone.setAttribute('aria-pressed', 'true');
    mostraStato('Sto ascoltando… parla pure, poi premi «Termina dettatura».', true);
  }

  function aspettoRiposo() {
    bottone.classList.remove('rec');
    bottone.innerHTML = `${ICONA_MICROFONO}<span>Inizia dettatura</span>`;
    bottone.setAttribute('aria-pressed', 'false');
    mostraStato('', false);
  }

  /**
   * Ripulisce il testo riconosciuto: maiuscola a inizio frase e nessuno
   * spazio prima della punteggiatura.
   */
  function sistema(testo) {
    let risultato = testo.replace(/\s+([,.;:!?])/g, '$1').trim();
    if (risultato) risultato = risultato[0].toUpperCase() + risultato.slice(1);
    return risultato;
  }

  /* -------------------------------------------------------------- eventi - */

  riconoscitore.addEventListener('result', (evento) => {
    let provvisorio = '';

    for (let i = evento.resultIndex; i < evento.results.length; i++) {
      const brano = evento.results[i][0].transcript;
      if (evento.results[i].isFinal) {
        consolidato = `${consolidato} ${sistema(brano)}`.trim();
      } else {
        provvisorio += brano;
      }
    }

    aggiornaCampo(provvisorio);
  });

  riconoscitore.addEventListener('error', (evento) => {
    switch (evento.error) {
      case 'not-allowed':
      case 'service-not-allowed':
        attiva = false;
        aspettoRiposo();
        mostraStato(
          'Microfono non autorizzato. Consenti l’accesso al microfono nelle ' +
          'impostazioni del browser, poi riprova.',
          true
        );
        setTimeout(() => mostraStato('', false), 7000);
        break;

      case 'no-speech':
        // Silenzio prolungato: normale in cantiere, si riparte da soli.
        break;

      case 'audio-capture':
        attiva = false;
        aspettoRiposo();
        mostraStato('Nessun microfono rilevato sul dispositivo.', true);
        setTimeout(() => mostraStato('', false), 6000);
        break;

      case 'network':
        mostraStato('Connessione assente: la dettatura richiede la rete.', true);
        break;

      default:
        console.warn('[dettatura] errore:', evento.error);
    }
  });

  /*
    Chrome interrompe il riconoscimento dopo circa un minuto anche in modalità
    continua. Se l'utente non ha premuto "Termina", si riavvia da soli: per
    lui la dettatura non si è mai fermata.
  */
  riconoscitore.addEventListener('end', () => {
    if (!attiva) { aspettoRiposo(); return; }
    try {
      riconoscitore.start();
    } catch {
      attiva = false;
      aspettoRiposo();
    }
  });

  /* ------------------------------------------------------------ comandi -- */

  function avvia() {
    testoBase   = campo.value.trim();
    consolidato = '';
    attiva      = true;

    try {
      riconoscitore.start();
      aspettoAscolto();
    } catch (errore) {
      // start() su un riconoscitore già avviato solleva un'eccezione: ignorala.
      console.warn('[dettatura] avvio non riuscito:', errore);
    }
  }

  function ferma() {
    attiva = false;
    try { riconoscitore.stop(); } catch { /* già ferma */ }
    aggiornaCampo();
    aspettoRiposo();
  }

  bottone.type = 'button';
  bottone.addEventListener('click', () => (attiva ? ferma() : avvia()));
  aspettoRiposo();

  // Se si cambia pagina mentre il microfono è aperto, va chiuso.
  window.addEventListener('pagehide', () => { if (attiva) ferma(); });

  return { ferma, inAscolto: () => attiva };
}

/**
 * Collega in un colpo solo tutti i campi della pagina che espongono
 * `data-detta="<id del campo>"` sul pulsante.
 * @returns {number} quanti campi sono stati collegati
 */
export function collegaTutteLeDettature(radice = document) {
  let collegati = 0;

  radice.querySelectorAll('[data-detta]').forEach((bottone) => {
    const campo = radice.querySelector(`#${bottone.dataset.detta}`);
    const stato = radice.querySelector(`#stato-${bottone.dataset.detta}`);
    if (campo && collegaDettatura(bottone, campo, stato)) collegati++;
  });

  return collegati;
}
