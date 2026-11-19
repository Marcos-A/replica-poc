/**
 * Funcions públiques del Laboratori (visibles al desplegable "Executa" de
 * l'editor d'Apps Script). La lògica és als mòduls; aquí només hi ha
 * punts d'entrada i missatges per al docent coordinador. El menú «Rèplica»
 * del full de càlcul (src/Menu.js) crida aquestes mateixes funcions.
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
  ['Compte', 'Main'],
  ['Menu', 'Menu'],
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

  var origen = Repositori.origen();
  var compte = Compte.comprova();
  afegeix('Compte', compte.correcte ? 'OK' : 'ERROR', compte.correcte
    ? 'el programa s\'executa amb el compte de prova, propietari del full (' + Registre.emmascaraCorreu(compte.propietari) + ')'
    : Registre.sanititza(compte.missatge));

  var propietatsQueFalten = Config.propietatsQueFalten();
  Config.OBLIGATORIES.forEach(function (nom) {
    var falta = propietatsQueFalten.indexOf(nom) !== -1;
    afegeix('Propietat ' + nom, falta ? 'ERROR' : 'OK',
      falta ? 'falta: afegeix-la a Configuració del projecte > Propietats de l\'script' : 'configurada');
  });

  if (origen.vinculat) {
    if (!origen.idPropietat) {
      afegeix('Full de càlcul', 'OK', 'el programa està instal·lat al full «' + origen.nomVinculat + '» (no cal SPREADSHEET_ID)');
    } else if (origen.idPropietat === origen.idVinculat) {
      afegeix('Propietat SPREADSHEET_ID', 'INFO', 'és el mateix full on està instal·lat el programa: no cal, podeu esborrar-la');
    } else {
      afegeix('Propietat SPREADSHEET_ID', 'ERROR', 'apunta a un full diferent d\'aquell on està instal·lat el programa: ' +
        'esborreu-la de les Propietats de l\'script');
    }
  } else {
    afegeix('Propietat SPREADSHEET_ID', origen.idPropietat ? 'OK' : 'ERROR', origen.idPropietat ? 'configurada'
      : 'falta: afegiu-la a les Propietats de l\'script (o instal·leu el programa des del full: Extensions › Apps Script)');
  }

  var ubicacio = Config.ubicacioClau();
  if (!ubicacio) {
    afegeix('Clau de Gemini', 'ERROR', 'falta: deseu-la amb Rèplica › Configuració › Desa la clau de Gemini ' +
      '(o afegiu la propietat GEMINI_API_KEY a les Propietats de l\'script)');
  } else if (ubicacio === Config.UBICACIONS_CLAU.USUARI) {
    afegeix('Clau de Gemini', 'OK', 'desada al compte de prova (no es veu a Configuració del projecte)');
  } else if (origen.vinculat) {
    afegeix('Clau de Gemini', 'AVÍS', 'és a les Propietats de l\'script, on la pot veure qualsevol persona que pugui editar ' +
      'el full. Per amagar-la, feu Rèplica › Configuració › Desa la clau de Gemini');
  } else {
    afegeix('Clau de Gemini', 'OK', 'configurada (Propietats de l\'script)');
  }

  var conf = Config.llegeix();
  var actius = [];
  afegeix('Interruptor global', 'INFO', conf.simulacioActivada ? 'SIMULATION_ENABLED=true (processament actiu)' : 'SIMULATION_ENABLED=false (no es processa ni s\'envia res)');

  [Config.PROPIETATS.PROVA_PARTICIPANT, Config.PROPIETATS.PROVA_ESCENARI].forEach(function (nom) {
    if (Config.propietat(nom)) {
      afegeix('Propietat ' + nom, 'AVÍS', 'ja no s\'utilitza (ara és a la pestanya Activacions): podeu esborrar-la');
    }
  });
  if (Config.propietat(Config.PROPIETATS.REMITENTS)) {
    afegeix('Propietat ALLOWED_SENDERS', 'AVÍS', 'ja no s\'utilitza (ara és la pestanya Participants): podeu esborrar-la');
  }

  if (origen.vinculat || origen.idPropietat) {
    try {
      Repositori.diagnostica().forEach(function (d) {
        if (!d.existeix) {
          afegeix('Pestanya ' + d.pestanya, 'ERROR', 'no existeix: ' + FES_PREPARA_);
        } else if (d.columnesQueFalten.length) {
          afegeix('Pestanya ' + d.pestanya, 'ERROR', 'falten columnes: ' + d.columnesQueFalten.join(', ') + ' (' + FES_PREPARA_ + ')');
        } else {
          afegeix('Pestanya ' + d.pestanya, 'OK', 'correcta');
        }
      });
      diagnosticaParametres_().forEach(function (d) { afegeix(d[0], d[1], d[2]); });
      diagnosticaParticipants_().forEach(function (d) { afegeix(d[0], d[1], d[2]); });
      actius = Repositori.participantsActius();
    } catch (e) {
      afegeix('Google Sheets', 'ERROR', 'no s\'hi pot accedir: ' + Registre.resumError(e));
    }
  }

  try {
    var gmail = Bustia.diagnostica();
    afegeix('Gmail', 'OK', 'accés correcte a la bústia ' + Registre.emmascaraCorreu(gmail.adreca));
    if (actius.indexOf(Config.normalitzaCorreu(gmail.adreca)) !== -1) {
      afegeix('Participants', 'ERROR', 'inclou la mateixa bústia de prova; desmarqueu-la o esborreu-la per evitar bucles');
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
  afegeix('Disparador', disparadors === 1 && aplicat ? 'OK' : disparadors === 1 ? 'AVÍS' : (disparadors === 0 ? 'AVÍS' : 'ERROR'),
    disparadors === 0 ? 'no n\'hi ha cap: ' + FES_DISPARADOR_ :
      disparadors > 1 ? disparadors + ' disparadors: ' + FES_DISPARADOR_ + ' perquè en quedi un de sol' :
        aplicat ? 'revisió cada ' + aplicat + ' minut(s)'
          : 'interval desconegut (creat amb una versió anterior): ' + FES_DISPARADOR_);

  var correcte = diagnostics.every(function (d) { return d.estat !== 'ERROR'; });
  var text = diagnostics.map(function (d) {
    return '[' + d.estat + '] ' + d.element + ': ' + d.detall;
  }).join('\n');
  Registre.info((correcte ? 'Configuració correcta' : 'Configuració incompleta') + '\n' + text);
  return { correcte: correcte, diagnostics: diagnostics, text: text };
}

var FES_PREPARA_ = 'feu Rèplica › Configuració › Prepara el full (o executeu preparaFulls)';
var FES_DISPARADOR_ = 'feu Rèplica › Revisió automàtica › Crea o actualitza (o executeu creaDisparador)';

/** Diagnòstic de la pestanya Participants: llista de [element, estat, detall]. */
function diagnosticaParticipants_() {
  var resultat = [];
  var llista = Repositori.participants();
  llista.filter(function (p) { return !Config.esCorreuValid(p.correu); }).forEach(function (p) {
    resultat.push(['Participants › fila ' + p.fila, 'ERROR', 'l\'adreça no és vàlida']);
  });
  var actius = Repositori.participantsActius().length;
  if (actius === 0) {
    resultat.push(['Participants', 'ERROR', llista.length === 0
      ? 'no hi ha cap participant: escriviu les adreces a la pestanya Participants i marqueu la casella actiu'
      : 'cap participant té marcada la casella actiu']);
  } else {
    resultat.push(['Participants', 'OK', actius + ' participant(s) actiu(s)' +
      (llista.length > actius ? ' i ' + (llista.length - actius) + ' inactiu(s) o no vàlid(s)' : '')]);
  }
  return resultat;
}

/** Diagnòstic de la pestanya Configuració: llista de [element, estat, detall]. */
function diagnosticaParametres_() {
  var resultat = [];
  var conf = Repositori.configuracio();
  conf.errors.forEach(function (e) {
    resultat.push(['Configuració › ' + e.clau, 'ERROR', e.missatge]);
  });
  var v = conf.valors;
  if (!conf.errors.some(function (e) { return e.clau === 'Configuració'; })) {
    resultat.push(['Configuració › interval_minuts', 'INFO', v.intervalMinuts + ' minut(s)' +
      (Disparador.compta() > 0 && Disparador.intervalAplicat() !== v.intervalMinuts
        ? ' (s\'aplicarà a la propera revisió automàtica, o ara mateix si ' + FES_DISPARADOR_ + ')' : '')]);
    resultat.push(['Configuració › max_torns_per_defecte', 'INFO', v.maxTornsPerDefecte + ' respostes']);
    var correus = Simulacio.correusDisponibles();
    resultat.push(['Configuració › correus_per_dia', correus.restants > 0 ? 'INFO' : 'AVÍS', correus.limit +
      ' correus en 24 hores; se n\'han enviat ' + correus.enviats + ' i en queden ' + correus.restants]);
  }
  return resultat;
}

/** Inicia una simulació amb una sola persona (sense activació). */
function iniciaSimulacio(correuParticipant, idEscenari) {
  if (!correuParticipant) {
    throw new Error('Cal indicar l\'adreça del participant. Des de l\'editor, fes servir enviaActivacioPendent().');
  }
  Compte.exigeix();
  return Simulacio.inicia(correuParticipant, idEscenari || 'ESC-001');
}

/**
 * Comprova una fila d'Activacions sense enviar res. Retorna { error } amb
 * el motiu, o { escenari, aEnviar, omesos: [{ correu, motiu }] }.
 * No s'envia res si alguna adreça no és correcta.
 */
function revisaActivacio_(a) {
  var E = Repositori.ESTATS_ACTIVACIO;
  if (a.estat === E.ENVIADA) {
    return { error: 'Aquesta activació (' + a.id_activacio + ') ja s\'ha enviat. Per enviar el correu inicial a més ' +
      'persones, afegiu una fila nova a la pestanya Activacions.' };
  }
  if (!Config.llegeix().simulacioActivada) {
    return { error: 'Les simulacions estan aturades. Quan el coordinador ho confirmi, activeu-les amb ' +
      'Rèplica › Simulacions ATURADES · Activa-les, i torneu a enviar l\'activació.' };
  }
  if (!a.escenari) return { error: 'Trieu l\'escenari a la columna escenari de la fila.' };
  var escenari = Repositori.escenari(a.escenari);
  if (!escenari) return { error: 'L\'escenari ' + a.escenari + ' no existeix a la pestanya Escenaris.' };
  if (!escenari.actiu) return { error: 'L\'escenari ' + a.escenari + ' no està actiu (columna actiu de la pestanya Escenaris).' };

  var destinataris = a.destinataris.filter(function (c, i, llista) { return llista.indexOf(c) === i; });
  if (destinataris.length === 0) {
    return { error: 'Escriviu almenys una adreça a la columna destinataris (diverses, separades per comes o una per línia).' };
  }
  var maxim = Config.LIMITS.MAX_DESTINATARIS_PER_ACTIVACIO;
  if (destinataris.length > maxim) {
    return { error: 'Una activació pot tenir com a màxim ' + maxim + ' destinataris; aquesta en té ' + destinataris.length + '.' };
  }
  var noValides = destinataris.filter(function (c) { return !Config.esCorreuValid(c); });
  if (noValides.length) {
    return { error: 'Aquestes adreces no són vàlides (reviseu que no hi faltin lletres ni l\'@):\n• ' + noValides.join('\n• ') +
      '\n\nNo s\'ha enviat res.' };
  }
  var actius = Repositori.participantsActius();
  var foraDeLlista = destinataris.filter(function (c) { return actius.indexOf(c) === -1; });
  if (foraDeLlista.length) {
    return { error: 'Aquestes adreces no són a la pestanya Participants, o no hi tenen marcada la casella actiu:\n• ' +
      foraDeLlista.join('\n• ') + '\n\nAfegiu-les-hi (o corregiu-les) i torneu-ho a provar. No s\'ha enviat res.' };
  }
  var propies = Bustia.adrecesPropies();
  var propia = destinataris.filter(function (c) { return propies.indexOf(c) !== -1; });
  if (propia.length) return { error: 'La bústia de prova no pot ser destinatària: ' + propia.join(', ') + '. No s\'ha enviat res.' };

  var converses = Repositori.converses();
  var omesos = [];
  var aEnviar = destinataris.filter(function (correu) {
    var seves = converses.filter(function (c) { return c.correu_participant === correu; });
    if (a.id_activacio && seves.some(function (c) { return c.id_activacio === a.id_activacio; })) {
      omesos.push({ correu: correu, motiu: 'ja l\'havia rebut en aquesta activació' });
      return false;
    }
    if (seves.some(function (c) { return c.id_escenari === escenari.id && c.estat !== Repositori.ESTATS_CONVERSA.FINALITZADA; })) {
      omesos.push({ correu: correu, motiu: 'ja té una conversa oberta d\'aquest escenari' });
      return false;
    }
    return true;
  });
  var correus = Simulacio.correusDisponibles();
  if (aEnviar.length > correus.restants) {
    return { error: 'Aquesta activació enviaria ' + aEnviar.length + ' correus, però en les properes hores només en ' +
      'queden ' + correus.restants + ' (límit de ' + correus.limit + ' en 24 hores, fila correus_per_dia de la pestanya ' +
      'Configuració). Envieu-la més tard o repartiu els destinataris en dues activacions.' };
  }
  return { escenari: escenari, aEnviar: aEnviar, omesos: omesos };
}

/**
 * Envia el correu inicial a cada destinatari d'una activació (un fil per
 * persona) i escriu el resultat a la fila. Retorna
 * { idActivacio, estat, enviats, omesos, errors }.
 */
function enviaActivacio_(a) {
  Compte.exigeix();
  var revisio = revisaActivacio_(a);
  if (revisio.error) throw new Error(revisio.error);
  var id = a.id_activacio || Repositori.seguentIdActivacio();
  if (!a.id_activacio) Repositori.actualitzaActivacio(a.fila, { id_activacio: id });

  var enviats = [];
  var errors = [];
  revisio.aEnviar.forEach(function (correu) {
    try {
      Simulacio.inicia(correu, revisio.escenari.id, id);
      enviats.push(correu);
    } catch (e) {
      errors.push({ correu: correu, motiu: Registre.resumError(e) });
    }
  });

  var estat = errors.length ? Repositori.ESTATS_ACTIVACIO.PARCIAL : Repositori.ESTATS_ACTIVACIO.ENVIADA;
  var parts = [enviats.length + ' enviat(s)'];
  if (revisio.omesos.length) {
    parts.push(revisio.omesos.length + ' omès/omesos: ' + revisio.omesos.map(function (o) { return o.correu + ' (' + o.motiu + ')'; }).join('; '));
  }
  if (errors.length) {
    parts.push(errors.length + ' amb error: ' + errors.map(function (o) { return o.correu + ' (' + o.motiu + ')'; }).join('; '));
  }
  Repositori.actualitzaActivacio(a.fila, {
    estat: estat,
    data_enviament: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
    resultat: parts.join(' · ')
  });
  Registre.info('Activació enviada', { idActivacio: id, estat: estat, enviats: enviats.length, omesos: revisio.omesos.length, errors: errors.length });
  return { idActivacio: id, estat: estat, enviats: enviats, omesos: revisio.omesos, errors: errors };
}

/**
 * Funció per a l'editor (instal·lació sense menú): envia la primera fila de
 * la pestanya Activacions que encara no s'ha enviat.
 */
function enviaActivacioPendent() {
  var pendents = Repositori.activacions().filter(function (a) { return a.estat === ''; });
  if (pendents.length === 0) {
    throw new Error('No hi ha cap activació per enviar: afegiu una fila a la pestanya Activacions (escenari i destinataris).');
  }
  return enviaActivacio_(pendents[0]);
}

/**
 * Funció del disparador temporal (i de Rèplica › Revisa ara). Un disparador
 * s'executa amb el compte de qui el va crear: si no és el compte de prova,
 * no es llegeix ni s'envia res.
 */
function processaCorreusPendents() {
  if (Config.llegeix().simulacioActivada) {
    var compte = Compte.comprova();
    if (!compte.correcte) {
      Registre.error('Revisió omesa: ' + compte.missatge);
      return { estat: 'COMPTE_INCORRECTE', missatge: compte.missatge };
    }
  }
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
  Compte.exigeix();
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
  return interval;
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

/**
 * Comprova que el programa s'executa amb el compte de prova. Les opcions
 * del menú s'executen amb el compte de qui hi fa clic, i un disparador amb
 * el de qui el va crear; si fos un altre compte, els correus sortirien del
 * seu Gmail. El compte de prova és el propietari del full de càlcul: no cal
 * configurar res, i només el propietari pot canviar-lo.
 */
var Compte = (function () {
  function resultat_(correcte, actual, propietari, missatge) {
    return { correcte: correcte, actual: actual, propietari: propietari, missatge: missatge || '' };
  }

  function comprova() {
    var actual = '';
    try {
      actual = Config.normalitzaCorreu(Session.getEffectiveUser().getEmail());
    } catch (e) { /* queda buit */ }
    var propietari = '';
    try {
      var usuari = Repositori.llibre().getOwner();
      propietari = usuari ? Config.normalitzaCorreu(usuari.getEmail()) : '';
    } catch (e) {
      return resultat_(false, actual, '', 'No s\'ha pogut obrir el full de càlcul: ' + Registre.resumError(e));
    }
    if (!propietari) {
      return resultat_(false, actual, '', 'No es pot saber de qui és el full de càlcul (passa, per exemple, si és en una ' +
        'unitat compartida). Rèplica necessita un full creat amb el compte de prova, a «El meu Drive» d\'aquest compte.');
    }
    if (!actual) {
      return resultat_(false, '', propietari, 'No es pot saber amb quin compte s\'executa el programa. ' +
        'Torneu-ho a provar havent entrat amb el compte de prova (' + propietari + ').');
    }
    if (actual !== propietari) {
      return resultat_(false, actual, propietari, 'Només el compte de prova (' + propietari + '), que és el propietari ' +
        'del full, pot fer servir Rèplica. Ara s\'està fent servir el compte ' + actual + '. Si continuéssiu, els correus ' +
        'sortirien d\'aquest compte.\n\nObriu el full havent entrat amb el compte de prova (per exemple, en una finestra ' +
        'd\'incògnit).');
    }
    return resultat_(true, actual, propietari);
  }

  /** Llança un error llegible si no és el compte de prova. */
  function exigeix() {
    var r = comprova();
    if (!r.correcte) throw new Error(r.missatge);
    return r;
  }

  return { comprova: comprova, exigeix: exigeix };
})();

/** Torna a ACTIVA una conversa en ERROR (després de revisar-la). */
function reactivaConversa(idConversa) {
  return Simulacio.reactiva(idConversa);
}

/** Marca una conversa com a FINALITZADA manualment. */
function tancaConversa(idConversa) {
  return Simulacio.tanca(idConversa);
}

/** Resum de l'estat de les converses (adreces emmascarades). */
function estatSimulacions() {
  var converses = Repositori.converses();
  var resum = { ACTIVA: 0, PROCESSANT: 0, FINALITZADA: 0, ERROR: 0 };
  converses.forEach(function (c) { resum[c.estat] = (resum[c.estat] || 0) + 1; });
  var linies = converses.map(function (c) {
    return c.id_conversa + ' · ' + c.id_escenari + ' · ' + Registre.emmascaraCorreu(c.correu_participant) +
      ' · ' + c.estat + ' · torns ' + c.torns_ia + (c.darrer_error ? ' · ' + c.darrer_error : '');
  });
  Registre.info('Converses: ' + JSON.stringify(resum) + (linies.length ? '\n' + linies.join('\n') : ''));

  var activada = Config.llegeix().simulacioActivada;
  var disparadors = Disparador.compta();
  var obertes = converses.filter(function (c) { return c.estat !== 'FINALITZADA'; });
  var MAX_LINIES = 15;
  var text = 'Simulacions: ' + (activada ? 'ACTIVADES' : 'ATURADES (no es respon ni s\'envia res)') + '\n' +
    'Revisió automàtica: ' + (disparadors === 0 ? 'no n\'hi ha'
      : 'cada ' + (Disparador.intervalAplicat() || '?') + ' minut(s)') + '\n\n' +
    'Converses: ' + resum.ACTIVA + ' actives · ' + resum.PROCESSANT + ' processant · ' +
    resum.ERROR + ' en error · ' + resum.FINALITZADA + ' finalitzades';
  if (obertes.length) {
    text += '\n\nConverses no finalitzades:\n' + obertes.slice(0, MAX_LINIES).map(function (c) {
      return '• ' + c.id_conversa + ' · ' + Registre.emmascaraCorreu(c.correu_participant) + ' · ' + c.estat +
        ' · ' + c.torns_ia + ' resposta(es)' + (c.darrer_error ? '\n   Error: ' + Registre.sanititza(c.darrer_error) : '');
    }).join('\n');
    if (obertes.length > MAX_LINIES) text += '\n… i ' + (obertes.length - MAX_LINIES) + ' més (vegeu la pestanya Converses).';
  }
  return { resum: resum, simulacioActivada: activada, text: text };
}
