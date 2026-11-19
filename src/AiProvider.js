/**
 * Abstracció del proveïdor d'IA.
 *
 * Contracte:
 *   genera({ escenari, historial, missatgesNous, configuracio })
 *     -> { text, finalitzada, proveidor, model }
 *
 * Els errors porten la propietat `reintentable` (true si val la pena tornar-ho
 * a provar a la propera execució: quota, saturació, temps d'espera).
 * En aquest MVP només hi ha Gemini.
 */
var ProveidorIA = (function () {
  function errorIA(missatge, reintentable, codi) {
    var e = new Error(missatge);
    e.reintentable = !!reintentable;
    e.codi = codi || 'IA';
    return e;
  }

  function validaContext_(context) {
    if (!context || !context.escenari) {
      throw errorIA('generaResposta necessita un context amb escenari, historial i missatgesNous.', false, 'CONTEXT');
    }
    if (!context.missatgesNous || context.missatgesNous.length === 0) {
      throw errorIA('No hi ha missatges nous per respondre.', false, 'CONTEXT');
    }
  }

  /** Comprova la sortida del proveïdor i la normalitza. */
  function validaSortida(sortida) {
    if (!sortida || typeof sortida.text !== 'string') {
      throw errorIA('El proveïdor no ha retornat cap text.', true, 'SORTIDA_BUIDA');
    }
    var text = sortida.text.trim();
    if (text.length < 20) {
      throw errorIA('La resposta generada és buida o massa curta.', true, 'SORTIDA_BUIDA');
    }
    if (text.length > Config.LIMITS.MAX_CARACTERS_RESPOSTA) {
      throw errorIA('La resposta generada supera el límit de ' + Config.LIMITS.MAX_CARACTERS_RESPOSTA + ' caràcters.', true, 'SORTIDA_LLARGA');
    }
    if (typeof sortida.finalitzada !== 'boolean') {
      throw errorIA('La resposta no indica si la conversa ha finalitzat.', true, 'SORTIDA_INVALIDA');
    }
    return {
      text: text,
      finalitzada: sortida.finalitzada,
      proveidor: sortida.proveidor,
      model: sortida.model
    };
  }

  function genera(context) {
    validaContext_(context);
    return validaSortida(Gemini.genera(context));
  }

  return {
    genera: genera,
    validaSortida: validaSortida,
    errorIA: errorIA
  };
})();
