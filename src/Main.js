/**
 * Funcions públiques del Laboratori (visibles al desplegable "Executa" de
 * l'editor d'Apps Script). La lògica és als mòduls; aquí només hi ha
 * punts d'entrada i missatges per al docent coordinador.
 */

/** Crea les pestanyes, capçaleres i l'escenari ESC-001 si falten. Idempotent. */
function preparaFulls() {
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

  var falten = Config.propietatsQueFalten();
  Config.OBLIGATORIES.forEach(function (nom) {
    afegeix('Propietat ' + nom, falten.indexOf(nom) === -1 ? 'OK' : 'ERROR',
      falten.indexOf(nom) === -1 ? 'configurada' : 'falta: afegeix-la a Configuració del projecte > Propietats de l\'script');
  });

  var conf = Config.llegeix();
  var remitents = conf.remitentsAutoritzats;
  var invalids = remitents.filter(function (c) { return !Config.esCorreuValid(c); });
  if (remitents.length > 0) {
    afegeix('ALLOWED_SENDERS', invalids.length ? 'ERROR' : 'OK',
      invalids.length ? invalids.length + ' adreça(es) no vàlida(es)' : remitents.length + ' adreça(es) autoritzada(es)');
  }
  var provaParticipant = Config.analitzaRemitents(Config.propietat(Config.PROPIETATS.PROVA_PARTICIPANT));
  if (provaParticipant.length === 0) {
    afegeix('PROVA_PARTICIPANT', 'AVÍS', 'no definida: cal per iniciar simulacions amb provaIniciaSimulacio()');
  } else if (provaParticipant.length > 1) {
    afegeix('PROVA_PARTICIPANT', 'ERROR', 'conté ' + provaParticipant.length + ' adreces; ha de contenir una sola adreça (la llista completa va a ALLOWED_SENDERS)');
  } else if (!Config.esCorreuValid(provaParticipant[0])) {
    afegeix('PROVA_PARTICIPANT', 'ERROR', 'l\'adreça no és vàlida');
  } else if (remitents.indexOf(provaParticipant[0]) === -1) {
    afegeix('PROVA_PARTICIPANT', 'ERROR', Registre.emmascaraCorreu(provaParticipant[0]) + ' no és a ALLOWED_SENDERS: afegeix-la-hi');
  } else {
    afegeix('PROVA_PARTICIPANT', 'OK', Registre.emmascaraCorreu(provaParticipant[0]) + ' (també és a ALLOWED_SENDERS)');
  }
  afegeix('Interruptor global', 'INFO', conf.simulacioActivada ? 'SIMULATION_ENABLED=true (processament actiu)' : 'SIMULATION_ENABLED=false (no es processa ni s\'envia res)');

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

  var disparadors = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'processaCorreusPendents';
  }).length;
  afegeix('Disparador', disparadors === 1 ? 'OK' : (disparadors === 0 ? 'AVÍS' : 'ERROR'),
    disparadors === 0 ? 'no n\'hi ha cap: executa creaDisparador()' :
      disparadors + ' disparador(s) de processaCorreusPendents' + (disparadors > 1 ? ': elimina\'n els sobrants amb eliminaDisparadors()' : ''));

  var correcte = diagnostics.every(function (d) { return d.estat !== 'ERROR'; });
  var text = diagnostics.map(function (d) {
    return '[' + d.estat + '] ' + d.element + ': ' + d.detall;
  }).join('\n');
  Registre.info((correcte ? 'Configuració correcta' : 'Configuració incompleta') + '\n' + text);
  return { correcte: correcte, diagnostics: diagnostics, text: text };
}

/** Inicia una simulació: envia el missatge inicial al participant. */
function iniciaSimulacio(correuParticipant, idEscenari) {
  if (!correuParticipant) {
    throw new Error('Cal indicar l\'adreça del participant. Des de l\'editor, fes servir provaIniciaSimulacio().');
  }
  return Simulacio.inicia(correuParticipant, idEscenari || 'ESC-001');
}

/**
 * Funció auxiliar per a l'editor: llegeix el participant de la propietat
 * PROVA_PARTICIPANT (i, opcionalment, l'escenari de PROVA_ESCENARI).
 * Així no cal escriure cap adreça real al codi.
 */
function provaIniciaSimulacio() {
  var correu = Config.propietat(Config.PROPIETATS.PROVA_PARTICIPANT);
  if (!correu) {
    throw new Error('Defineix la propietat PROVA_PARTICIPANT amb l\'adreça del docent participant.');
  }
  if (Config.analitzaRemitents(correu).length > 1) {
    throw new Error('PROVA_PARTICIPANT ha de contenir una sola adreça (la del docent amb qui inicies ' +
      'aquesta simulació). La llista de tots els participants va a ALLOWED_SENDERS.');
  }
  var escenari = Config.propietat(Config.PROPIETATS.PROVA_ESCENARI) || 'ESC-001';
  var resultat = iniciaSimulacio(correu, escenari);
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

/** Crea el disparador temporal (un de sol). minuts: 1, 5, 10, 15 o 30. */
function creaDisparador(minuts) {
  var interval = Number(minuts) || Config.LIMITS.INTERVAL_DISPARADOR_MINUTS;
  if ([1, 5, 10, 15, 30].indexOf(interval) === -1) {
    throw new Error('Interval no vàlid: ' + interval + '. Valors permesos: 1, 5, 10, 15 o 30 minuts.');
  }
  eliminaDisparadors();
  ScriptApp.newTrigger('processaCorreusPendents').timeBased().everyMinutes(interval).create();
  Registre.info('Disparador creat: processaCorreusPendents cada ' + interval + ' minut(s).');
}

/** Elimina els disparadors de processaCorreusPendents. */
function eliminaDisparadors() {
  var eliminats = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processaCorreusPendents') {
      ScriptApp.deleteTrigger(t);
      eliminats++;
    }
  });
  Registre.info('Disparadors eliminats: ' + eliminats);
  return eliminats;
}

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
