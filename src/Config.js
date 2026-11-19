/**
 * Configuració: lectura de Script Properties i límits del prototip.
 *
 * Els secrets (GEMINI_API_KEY) només es llegeixen a clauApi() i no es
 * retornen mai en cap altre objecte, diagnòstic ni registre.
 *
 * La clau pot ser en dos llocs:
 * - Propietats d'usuari del compte de prova (desaClau, des del menú). No es
 *   veuen a Configuració del projecte, i el codi que executa una altra
 *   persona no les pot llegir. Tenen prioritat.
 * - Propietats de l'script. Qualsevol editor del projecte les veu; en un
 *   projecte vinculat, això vol dir qualsevol editor del full.
 */
var Config = (function () {
  var PROPIETATS = {
    CLAU: 'GEMINI_API_KEY',
    MODEL: 'GEMINI_MODEL',
    FULL: 'SPREADSHEET_ID',
    ACTIVAT: 'SIMULATION_ENABLED',
    // Interna: interval amb què es va crear el disparador actual.
    INTERVAL_APLICAT: 'INTERVAL_APLICAT',
    // Obsoletes. ALLOWED_SENDERS: ara és la pestanya Participants, i
    // preparaFulls() hi copia les adreces en crear-la. PROVA_*: versions
    // anteriors. comprovaConfiguracio() avisa que es poden esborrar.
    REMITENTS: 'ALLOWED_SENDERS',
    PROVA_PARTICIPANT: 'PROVA_PARTICIPANT',
    PROVA_ESCENARI: 'PROVA_ESCENARI'
  };

  /**
   * Propietats de l'script sempre obligatòries. La clau (que pot ser a les
   * propietats d'usuari) i SPREADSHEET_ID (opcional si el projecte està
   * vinculat al full) es comproven a part.
   */
  var OBLIGATORIES = [
    PROPIETATS.MODEL,
    PROPIETATS.ACTIVAT
  ];

  var UBICACIONS_CLAU = { USUARI: 'USUARI', SCRIPT: 'SCRIPT' };

  /**
   * Límits de volum i durada. Els valors per defecte de l'interval i dels
   * torns es poden canviar a la pestanya Configuració; la resta, només aquí.
   */
  var LIMITS = {
    INTERVALS_PERMESOS: [1, 5, 10, 15, 30],
    MAX_TORNS_PER_DEFECTE: 6,
    MAX_TORNS_ABSOLUT: 12,
    // Respostes de la IA per execució (totes les converses es llegeixen).
    MAX_RESPOSTES_PER_EXECUCIO: 10,
    MAX_DESTINATARIS_PER_ACTIVACIO: 50,
    // Correus que pot enviar Apps Script en 24 hores: compte de Gmail o Workspace.
    CORREUS_PER_DIA_PERMESOS: [100, 1500],
    CORREUS_PER_DIA_PER_DEFECTE: 100,
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

  function propietatsUsuari_() {
    return PropertiesService.getUserProperties();
  }

  function clauUsuari_() {
    return String(propietatsUsuari_().getProperty(PROPIETATS.CLAU) || '').trim();
  }

  function clauScript_() {
    return String(propietats_().getProperty(PROPIETATS.CLAU) || '').trim();
  }

  function normalitzaCorreu(correu) {
    return String(correu || '').trim().toLowerCase();
  }

  function esCorreuValid(correu) {
    return REGEX_CORREU.test(normalitzaCorreu(correu));
  }

  /** Converteix "a@x.cat, b@y.cat; c@z.cat" (o una adreça per línia) en una llista normalitzada. */
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
      simulacioActivada: esCert_(p.getProperty(PROPIETATS.ACTIVAT)),
      teClauApi: ubicacioClau() !== null
    };
  }

  /** Únic punt d'accés a la clau. No la registris ni la retornis enlloc. */
  function clauApi() {
    var clau = clauUsuari_() || clauScript_();
    if (!clau) {
      throw new Error('Falta la clau de Gemini: deseu-la amb Rèplica › Configuració › Desa la clau de Gemini ' +
        '(o afegiu la propietat ' + PROPIETATS.CLAU + ' a les Propietats de l\'script).');
    }
    return clau;
  }

  /** On és la clau: 'USUARI', 'SCRIPT' o null. No en retorna mai el valor. */
  function ubicacioClau() {
    if (clauUsuari_()) return UBICACIONS_CLAU.USUARI;
    if (clauScript_()) return UBICACIONS_CLAU.SCRIPT;
    return null;
  }

  /**
   * Desa la clau a les propietats d'usuari de qui executa (el compte de
   * prova) i l'esborra de les Propietats de l'script, on la veuria qualsevol
   * editor. Retorna { esborradaDeScript }.
   */
  function desaClau(clau) {
    var neta = String(clau || '').trim();
    if (!/^\S{20,}$/.test(neta)) {
      throw new Error('Això no sembla una clau de Gemini: ha de ser un sol bloc de text, sense espais ' +
        '(normalment comença per AIza).');
    }
    propietatsUsuari_().setProperty(PROPIETATS.CLAU, neta);
    var esborrada = clauScript_() !== '';
    if (esborrada) propietats_().deleteProperty(PROPIETATS.CLAU);
    return { esborradaDeScript: esborrada };
  }

  /** Noms de les propietats obligatòries que falten o són buides. */
  function propietatsQueFalten() {
    var p = propietats_();
    return OBLIGATORIES.filter(function (nom) {
      return String(p.getProperty(nom) || '').trim() === '';
    });
  }

  function estableixSimulacio(activada) {
    propietats_().setProperty(PROPIETATS.ACTIVAT, activada ? 'true' : 'false');
  }

  /** Desa una propietat interna (mai la clau d'API). */
  function estableixPropietat(nom, valor) {
    if (nom === PROPIETATS.CLAU) throw new Error('La clau d\'API no es pot modificar des del codi.');
    propietats_().setProperty(nom, String(valor));
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
    UBICACIONS_CLAU: UBICACIONS_CLAU,
    LIMITS: LIMITS,
    llegeix: llegeix,
    clauApi: clauApi,
    ubicacioClau: ubicacioClau,
    desaClau: desaClau,
    propietatsQueFalten: propietatsQueFalten,
    estableixSimulacio: estableixSimulacio,
    propietat: propietat,
    estableixPropietat: estableixPropietat,
    analitzaRemitents: analitzaRemitents,
    normalitzaCorreu: normalitzaCorreu,
    esCorreuValid: esCorreuValid
  };
})();
