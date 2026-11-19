/**
 * Configuració: lectura de Script Properties i límits del prototip.
 *
 * Els secrets (GEMINI_API_KEY) només es llegeixen a clauApi() i no es
 * retornen mai en cap altre objecte, diagnòstic ni registre.
 */
var Config = (function () {
  var PROPIETATS = {
    CLAU: 'GEMINI_API_KEY',
    MODEL: 'GEMINI_MODEL',
    FULL: 'SPREADSHEET_ID',
    REMITENTS: 'ALLOWED_SENDERS',
    ACTIVAT: 'SIMULATION_ENABLED',
    // Opcional: adreça per a la funció auxiliar provaIniciaSimulacio().
    PROVA_PARTICIPANT: 'PROVA_PARTICIPANT',
    PROVA_ESCENARI: 'PROVA_ESCENARI'
  };

  var OBLIGATORIES = [
    PROPIETATS.CLAU,
    PROPIETATS.MODEL,
    PROPIETATS.FULL,
    PROPIETATS.REMITENTS,
    PROPIETATS.ACTIVAT
  ];

  /** Límits de volum i durada. Ajustables aquí, no des de Sheets. */
  var LIMITS = {
    MAX_TORNS_PER_DEFECTE: 6,
    MAX_TORNS_ABSOLUT: 12,
    MAX_CONVERSES_PER_EXECUCIO: 10,
    // Les execucions d'Apps Script s'aturen als 6 minuts; deixem marge.
    TEMPS_MAX_EXECUCIO_MS: 4 * 60 * 1000,
    ESPERA_BLOQUEIG_MS: 2000,
    MAX_CARACTERS_MISSATGE_ENTRANT: 4000,
    MAX_CARACTERS_HISTORIAL: 20000,
    MAX_CARACTERS_RESPOSTA: 2500,
    MAX_TOKENS_SORTIDA: 4096,
    INTERVAL_DISPARADOR_MINUTS: 5
  };

  var REGEX_CORREU = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

  function propietats_() {
    return PropertiesService.getScriptProperties();
  }

  function normalitzaCorreu(correu) {
    return String(correu || '').trim().toLowerCase();
  }

  function esCorreuValid(correu) {
    return REGEX_CORREU.test(normalitzaCorreu(correu));
  }

  /** Converteix "a@x.cat, b@y.cat; c@z.cat" en una llista normalitzada. */
  function analitzaRemitents(valor) {
    return String(valor || '')
      .split(/[\s,;]+/)
      .map(normalitzaCorreu)
      .filter(function (c) { return c.length > 0; });
  }

  function esCert_(valor) {
    return String(valor || '').trim().toLowerCase() === 'true';
  }

  /** Configuració no secreta. No inclou mai la clau d'API. */
  function llegeix() {
    var p = propietats_();
    return {
      model: String(p.getProperty(PROPIETATS.MODEL) || '').trim().replace(/^models\//, ''),
      spreadsheetId: String(p.getProperty(PROPIETATS.FULL) || '').trim(),
      remitentsAutoritzats: analitzaRemitents(p.getProperty(PROPIETATS.REMITENTS)),
      simulacioActivada: esCert_(p.getProperty(PROPIETATS.ACTIVAT)),
      teClauApi: String(p.getProperty(PROPIETATS.CLAU) || '').trim().length > 0
    };
  }

  /** Únic punt d'accés a la clau. No la registris ni la retornis enlloc. */
  function clauApi() {
    var clau = String(propietats_().getProperty(PROPIETATS.CLAU) || '').trim();
    if (!clau) {
      throw new Error('Falta la propietat ' + PROPIETATS.CLAU + ' a Script Properties.');
    }
    return clau;
  }

  /** Noms de les propietats obligatòries que falten o són buides. */
  function propietatsQueFalten() {
    var p = propietats_();
    return OBLIGATORIES.filter(function (nom) {
      return String(p.getProperty(nom) || '').trim() === '';
    });
  }

  function esRemitentAutoritzat(correu) {
    var c = normalitzaCorreu(correu);
    return llegeix().remitentsAutoritzats.indexOf(c) !== -1;
  }

  function estableixSimulacio(activada) {
    propietats_().setProperty(PROPIETATS.ACTIVAT, activada ? 'true' : 'false');
  }

  function propietat(nom) {
    if (nom === PROPIETATS.CLAU) {
      throw new Error('La clau d\'API només es pot llegir amb Config.clauApi().');
    }
    return String(propietats_().getProperty(nom) || '').trim();
  }

  return {
    PROPIETATS: PROPIETATS,
    OBLIGATORIES: OBLIGATORIES,
    LIMITS: LIMITS,
    llegeix: llegeix,
    clauApi: clauApi,
    propietatsQueFalten: propietatsQueFalten,
    esRemitentAutoritzat: esRemitentAutoritzat,
    estableixSimulacio: estableixSimulacio,
    propietat: propietat,
    analitzaRemitents: analitzaRemitents,
    normalitzaCorreu: normalitzaCorreu,
    esCorreuValid: esCorreuValid
  };
})();
