/**
 * Funcions públiques del Laboratori (visibles al desplegable "Executa" de
 * l'editor d'Apps Script). La lògica és als mòduls; aquí només hi ha
 * punts d'entrada i missatges per al docent coordinador.
 */

/**
 * Mòduls que han d'existir i fitxer de src/ que els defineix. Si se n'ha
 * enganxat un al fitxer equivocat de l'editor, aquí es detecta.
 */
var MODULS_ = [
  ['ProveidorIA', 'AiProvider'],
  ['Config', 'Config'],
  ['Simulacio', 'ConversationService'],
  ['ESCENARI_INICIAL', 'EscenariInicial'],
  ['Gemini', 'GeminiProvider'],
  ['Bustia', 'GmailGateway'],
  ['Registre', 'Logger'],
  ['Disparador', 'Main'],
  ['Indicacions', 'PromptBuilder'],
  ['Repositori', 'SheetsRepository']
];

/** Llista de mòduls que no s'han carregat. No depèn de cap altre mòdul. */
function modulsQueFalten_() {
  var global = typeof globalThis !== 'undefined' ? globalThis : this;
  return MODULS_.filter(function (m) { return typeof global[m[0]] === 'undefined'; })
    .map(function (m) {
      return 'falta ' + m[0] + ': torneu a enganxar dist/Replica.gs sencer (o, si teniu els fitxers separats, ' +
        'src/' + m[1] + '.js al fitxer ' + m[1] + '.gs)';
    });
}

function exigeixModuls_() {
  var falten = modulsQueFalten_();
  if (falten.length) throw new Error('Codi incomplet a l\'editor:\n- ' + falten.join('\n- '));
}

/** Crea les pestanyes, capçaleres i l'escenari ESC-001 si falten. Idempotent. */
function preparaFulls() {
  exigeixModuls_();
  var canvis = Repositori.preparaFulls(ESCENARI_INICIAL);
  var missatge = canvis.length ? 'Canvis:\n- ' + canvis.join('\n- ') : 'Tot ja estava preparat; no s\'ha canviat res.';
  Registre.info(missatge);
  return canvis;
}

/**
 * Verifica la configuració i els accessos. No mostra mai la clau d'API.
 * @param {boolean=} ometGemini true per no fer la consulta del model.
 */
function comprovaConfiguracio(ometGemini) {
  var diagnostics = [];
  function afegeix(element, estat, detall) {
    diagnostics.push({ element: element, estat: estat, detall: detall });
  }

  // Primer, el codi: sense tots els mòduls, la resta de comprovacions fallaria.
  var falten = modulsQueFalten_();
  if (falten.length) {
    falten.forEach(function (f) { afegeix('Codi', 'ERROR', f); });
    var textCodi = diagnostics.map(function (d) { return '[' + d.estat + '] ' + d.element + ': ' + d.detall; }).join('\n');
    console.error('Configuració incompleta\n' + textCodi);
    return { correcte: false, diagnostics: diagnostics, text: textCodi };
  }
  afegeix('Codi', 'OK', 'tots els mòduls carregats');

  var propietatsQueFalten = Config.propietatsQueFalten();
  Config.OBLIGATORIES.forEach(function (nom) {
    var falta = propietatsQueFalten.indexOf(nom) !== -1;
    afegeix('Propietat ' + nom, falta ? 'ERROR' : 'OK',
      falta ? 'falta: afegeix-la a Configuració del projecte > Propietats de l\'script' : 'configurada');
  });

  var conf = Config.llegeix();
  var remitents = conf.remitentsAutoritzats;
  var invalids = remitents.filter(function (c) { return !Config.esCorreuValid(c); });
  if (remitents.length > 0) {
    afegeix('ALLOWED_SENDERS', invalids.length ? 'ERROR' : 'OK',
      invalids.length ? invalids.length + ' adreça(es) no vàlida(es)' : remitents.length + ' adreça(es) autoritzada(es)');
  }
  afegeix('Interruptor global', 'INFO', conf.simulacioActivada ? 'SIMULATION_ENABLED=true (processament actiu)' : 'SIMULATION_ENABLED=false (no es processa ni s\'envia res)');

  [Config.PROPIETATS.PROVA_PARTICIPANT, Config.PROPIETATS.PROVA_ESCENARI].forEach(function (nom) {
    if (Config.propietat(nom)) {
      afegeix('Propietat ' + nom, 'AVÍS', 'ja no s\'utilitza (ara és a la pestanya Configuració): podeu esborrar-la');
    }
  });

  if (conf.spreadsheetId) {
    try {
      Repositori.diagnostica().forEach(function (d) {
        if (!d.existeix) {
          afegeix('Pestanya ' + d.pestanya, 'ERROR', 'no existeix: executa preparaFulls()');
        } else if (d.columnesQueFalten.length) {
          afegeix('Pestanya ' + d.pestanya, 'ERROR', 'falten columnes: ' + d.columnesQueFalten.join(', ') + ' (executa preparaFulls())');
        } else {
          afegeix('Pestanya ' + d.pestanya, 'OK', 'correcta');
        }
      });
      diagnosticaParametres_(remitents).forEach(function (d) { afegeix(d[0], d[1], d[2]); });
    } catch (e) {
      afegeix('Google Sheets', 'ERROR', 'no s\'hi pot accedir: ' + Registre.resumError(e));
    }
  }

  try {
    var gmail = Bustia.diagnostica();
    afegeix('Gmail', 'OK', 'accés correcte a la bústia ' + Registre.emmascaraCorreu(gmail.adreca));
    if (remitents.indexOf(Config.normalitzaCorreu(gmail.adreca)) !== -1) {
      afegeix('ALLOWED_SENDERS', 'ERROR', 'inclou la mateixa bústia de prova; treu-la per evitar bucles');
    }
  } catch (e) {
    afegeix('Gmail', 'ERROR', 'sense accés: ' + Registre.resumError(e));
  }

  if (!ometGemini && conf.teClauApi && conf.model) {
    try {
      var model = Gemini.comprovaModel();
      afegeix('Gemini', model.correcte ? 'OK' : 'ERROR', Registre.sanititza(model.detall));
    } catch (e) {
      afegeix('Gemini', 'ERROR', 'no s\'ha pogut consultar: ' + Registre.resumError(e));
    }
  }

  var disparadors = Disparador.compta();
  var aplicat = Disparador.intervalAplicat();
  afegeix('Disparador', disparadors === 1 ? 'OK' : (disparadors === 0 ? 'AVÍS' : 'ERROR'),
    disparadors === 0 ? 'no n\'hi ha cap: executa creaDisparador()' :
      disparadors > 1 ? disparadors + ' disparadors: executa creaDisparador() perquè en quedi un de sol' :
        'revisió cada ' + (aplicat || '?') + ' minut(s)');

  var correcte = diagnostics.every(function (d) { return d.estat !== 'ERROR'; });
  var text = diagnostics.map(function (d) {
    return '[' + d.estat + '] ' + d.element + ': ' + d.detall;
  }).join('\n');
  Registre.info((correcte ? 'Configuració correcta' : 'Configuració incompleta') + '\n' + text);
  return { correcte: correcte, diagnostics: diagnostics, text: text };
}

/** Diagnòstic de la pestanya Configuració: llista de [element, estat, detall]. */
function diagnosticaParametres_(remitents) {
  var resultat = [];
  var conf = Repositori.configuracio();
  conf.errors.forEach(function (e) {
    resultat.push(['Configuració › ' + e.clau, 'ERROR', e.missatge]);
  });
  var v = conf.valors;
  if (!conf.errors.some(function (e) { return e.clau === 'Configuració'; })) {
    resultat.push(['Configuració › interval_minuts', 'INFO', v.intervalMinuts + ' minut(s)' +
      (Disparador.compta() > 0 && Disparador.intervalAplicat() !== v.intervalMinuts
        ? ' (s\'aplicarà a la propera revisió automàtica, o ara mateix si executeu creaDisparador)' : '')]);
    var escenari = Repositori.escenari(v.escenari);
    resultat.push(['Configuració › escenari', escenari && escenari.actiu ? 'OK' : 'ERROR',
      !escenari ? v.escenari + ' no existeix a la pestanya Escenaris' :
        !escenari.actiu ? v.escenari + ' no està actiu (columna actiu)' : v.escenari + ' (' + escenari.titol + ')']);
    var p = v.participants;
    if (p.length === 0) {
      resultat.push(['Configuració › participant', 'AVÍS', 'buit: cal per iniciar simulacions amb provaIniciaSimulacio()']);
    } else if (p.length > 1) {
      resultat.push(['Configuració › participant', 'ERROR', 'conté ' + p.length + ' adreces; ha de contenir una sola adreça (la llista completa va a ALLOWED_SENDERS)']);
    } else if (!Config.esCorreuValid(p[0])) {
      resultat.push(['Configuració › participant', 'ERROR', 'l\'adreça no és vàlida']);
    } else if (remitents.indexOf(p[0]) === -1) {
      resultat.push(['Configuració › participant', 'ERROR', Registre.emmascaraCorreu(p[0]) + ' no és a ALLOWED_SENDERS: afegiu-la-hi']);
    } else {
      resultat.push(['Configuració › participant', 'OK', Registre.emmascaraCorreu(p[0]) + ' (també és a ALLOWED_SENDERS)']);
    }
    resultat.push(['Configuració › max_torns_per_defecte', 'INFO', v.maxTornsPerDefecte + ' respostes']);
  }
  return resultat;
}

/** Inicia una simulació: envia el missatge inicial al participant. */
function iniciaSimulacio(correuParticipant, idEscenari) {
  if (!correuParticipant) {
    throw new Error('Cal indicar l\'adreça del participant. Des de l\'editor, fes servir provaIniciaSimulacio().');
  }
  return Simulacio.inicia(correuParticipant, idEscenari || 'ESC-001');
}

/**
 * Funció per a l'editor: inicia una simulació amb el participant i
 * l'escenari indicats a la pestanya Configuració. Així no cal escriure
 * cap adreça real al codi.
 */
function provaIniciaSimulacio() {
  var v = Repositori.configuracio().valors;
  if (v.participants.length === 0) {
    throw new Error('Escriviu l\'adreça del docent participant a la pestanya Configuració (fila participant).');
  }
  if (v.participants.length > 1) {
    throw new Error('La fila participant de la pestanya Configuració ha de contenir una sola adreça (la del ' +
      'docent amb qui inicieu aquesta simulació). La llista de tots els participants va a ALLOWED_SENDERS.');
  }
  var resultat = iniciaSimulacio(v.participants[0], v.escenari);
  Registre.info('Conversa creada', resultat);
  return resultat;
}

/** Funció del disparador temporal. */
function processaCorreusPendents() {
  return Simulacio.processaPendents();
}

/** Interruptor global: atura tot processament i enviament automàtic. */
function aturaSimulacions() {
  Config.estableixSimulacio(false);
  Registre.info('SIMULATION_ENABLED=false: processament aturat.');
}

/** Interruptor global: activa el processament (només amb confirmació del coordinador). */
function activaSimulacions() {
  Config.estableixSimulacio(true);
  Registre.info('SIMULATION_ENABLED=true: processament activat.');
}

/**
 * Punt d'entrada independent del proveïdor.
 * generaResposta({ escenari, historial, missatgesNous, configuracio })
 *   -> { text, finalitzada, proveidor, model }
 */
function generaResposta(context) {
  return ProveidorIA.genera(context);
}

/**
 * Crea el disparador temporal (un de sol) amb l'interval de la pestanya
 * Configuració. Si es passa `minuts` (1, 5, 10, 15 o 30), també el desa a
 * la pestanya, perquè la revisió automàtica no el desfaci.
 */
function creaDisparador(minuts) {
  var interval;
  if (minuts !== undefined && minuts !== null && minuts !== '') {
    interval = Number(minuts);
    if (Config.LIMITS.INTERVALS_PERMESOS.indexOf(interval) === -1) {
      throw new Error('Interval no vàlid: ' + minuts + '. Valors permesos: 1, 5, 10, 15 o 30 minuts.');
    }
    Repositori.estableixConfiguracio('interval_minuts', interval);
  } else {
    interval = Repositori.configuracio().valors.intervalMinuts;
  }
  Disparador.crea(interval);
  Registre.info('Disparador creat: processaCorreusPendents cada ' + interval + ' minut(s).');
}

/** Elimina els disparadors de processaCorreusPendents. */
function eliminaDisparadors() {
  var eliminats = Disparador.elimina();
  Registre.info('Disparadors eliminats: ' + eliminats);
  return eliminats;
}

/**
 * Gestió del disparador temporal. Apps Script no permet llegir l'interval
 * d'un disparador existent, per això es desa a la propietat INTERVAL_APLICAT.
 */
var Disparador = (function () {
  var FUNCIO = 'processaCorreusPendents';

  function propis_() {
    return ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === FUNCIO; });
  }

  function compta() { return propis_().length; }

  function elimina() {
    var llista = propis_();
    llista.forEach(function (t) { ScriptApp.deleteTrigger(t); });
    return llista.length;
  }

  function crea(interval) {
    elimina();
    ScriptApp.newTrigger(FUNCIO).timeBased().everyMinutes(interval).create();
    Config.estableixPropietat(Config.PROPIETATS.INTERVAL_APLICAT, interval);
  }

  function intervalAplicat() {
    return Number(Config.propietat(Config.PROPIETATS.INTERVAL_APLICAT)) || null;
  }

  /**
   * Si l'interval de la pestanya Configuració ha canviat, recrea el
   * disparador. No en crea cap si s'han eliminat expressament.
   */
  function sincronitza() {
    if (compta() === 0) return false;
    var desitjat = Repositori.configuracio().valors.intervalMinuts;
    if (intervalAplicat() === desitjat && compta() === 1) return false;
    crea(desitjat);
    Registre.info('Interval de revisió actualitzat a ' + desitjat + ' minut(s).');
    return true;
  }

  return { compta: compta, elimina: elimina, crea: crea, intervalAplicat: intervalAplicat, sincronitza: sincronitza };
})();

/** Torna a ACTIVA una conversa en ERROR (després de revisar-la). */
function reactivaConversa(idConversa) {
  return Simulacio.reactiva(idConversa);
}

/** Marca una conversa com a FINALITZADA manualment. */
function tancaConversa(idConversa) {
  return Simulacio.tanca(idConversa);
}

/** Resum de l'estat de les converses, per supervisar des de l'editor. */
function estatSimulacions() {
  var converses = Repositori.converses();
  var resum = { ACTIVA: 0, PROCESSANT: 0, FINALITZADA: 0, ERROR: 0 };
  converses.forEach(function (c) { resum[c.estat] = (resum[c.estat] || 0) + 1; });
  var linies = converses.map(function (c) {
    return c.id_conversa + ' · ' + c.id_escenari + ' · ' + Registre.emmascaraCorreu(c.correu_participant) +
      ' · ' + c.estat + ' · torns ' + c.torns_ia + (c.darrer_error ? ' · ' + c.darrer_error : '');
  });
  Registre.info('Converses: ' + JSON.stringify(resum) + (linies.length ? '\n' + linies.join('\n') : ''));
  return { resum: resum, simulacioActivada: Config.llegeix().simulacioActivada };
}
