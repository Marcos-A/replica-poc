/**
 * Adaptador de Gemini API (Interactions API, v1beta).
 *
 * Referència verificada el 19/11/2026: https://ai.google.dev/gemini-api/docs
 *   POST https://generativelanguage.googleapis.com/v1beta/interactions
 *   Capçaleres: x-goog-api-key, Api-Revision
 *   Cos: model, system_instruction, input, generation_config, response_format, store
 *   Resposta: { status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text }] }] }
 *
 * La clau viatja a la capçalera (mai a l'URL), de manera que no apareix en
 * cap missatge d'error d'UrlFetchApp.
 */
var Gemini = (function () {
  var URL_BASE = 'https://generativelanguage.googleapis.com/v1beta';
  var API_REVISION = '2026-05-20';
  var PROVEIDOR = 'gemini';

  /**
   * El correu es demana per parts i el codi el munta (componCorreu): si es
   * demana en un sol text, el model de vegades el retorna sense cap salt de
   * línia, amb la salutació, el cos i la signatura en un sol paràgraf.
   */
  var ESQUEMA_SORTIDA = {
    type: 'object',
    properties: {
      salutacio: {
        type: 'string',
        description: 'Només la salutació inicial, per exemple "Bon dia," o "Benvolgut Sr. Puig,".'
      },
      paragrafs: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Cos del correu, un element per paràgraf (normalment de dos a quatre). Sense salutació, comiat ni signatura.'
      },
      comiat: {
        type: 'string',
        description: 'Només la fórmula de comiat, sense nom ni signatura, per exemple "Atentament," o "Salutacions,".'
      },
      finalitzada: {
        type: 'boolean',
        description: 'true només si aquest missatge tanca la situació.'
      }
    },
    required: ['salutacio', 'paragrafs', 'comiat', 'finalitzada'],
    additionalProperties: false
  };

  /** Cos de la petició (funció pura, provada a npm test). */
  function construeixPeticio(model, indicacions) {
    return {
      model: model,
      system_instruction: indicacions.sistema,
      input: indicacions.entrada,
      generation_config: {
        max_output_tokens: Config.LIMITS.MAX_TOKENS_SORTIDA
      },
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: ESQUEMA_SORTIDA
      },
      // No cal desar la interacció al servidor: cada torn envia el seu context.
      store: false
    };
  }

  function missatgeErrorApi_(cos) {
    try {
      var json = JSON.parse(cos);
      if (json && json.error) {
        return String(json.error.status || json.error.code || '') + ' ' + String(json.error.message || '');
      }
    } catch (e) { /* cos no JSON */ }
    return String(cos || '').slice(0, 200);
  }

  /** Extreu el text generat, acceptant el format "steps" i l'antic "outputs". */
  function extreuText_(json) {
    var trossos = [];
    (json.steps || []).forEach(function (pas) {
      if (pas.type !== 'model_output') return;
      (pas.content || []).forEach(function (c) {
        if (c.type === 'text' && typeof c.text === 'string') trossos.push(c.text);
      });
    });
    if (trossos.length === 0) {
      (json.outputs || []).forEach(function (o) {
        if (o.type === 'text' && typeof o.text === 'string') trossos.push(o.text);
      });
    }
    return trossos.join('');
  }

  /** Neteja Markdown residual que el model pugui haver afegit. */
  function netejaText(text) {
    return String(text)
      .replace(/\r\n?/g, '\n')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*Assumpte\s*:.*\n+/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Signatura a partir de l'escenari, una dada per línia:
   * "Marta Soler, responsable de compres" + "Ferreteria Soler SL" →
   * "Marta Soler\nResponsable de compres\nFerreteria Soler SL".
   */
  function signatura(escenari) {
    var e = escenari || {};
    var parts = String(e.interlocutor || '').split(',');
    var nom = parts[0].trim();
    var carrec = parts.slice(1).join(',').trim();
    if (carrec) carrec = carrec.charAt(0).toUpperCase() + carrec.slice(1);
    return [nom, carrec, String(e.empresa || '').trim()].filter(function (l) { return l; }).join('\n');
  }

  /**
   * Munta el correu a partir de les parts: salutació, paràgrafs separats per
   * una línia en blanc, comiat i signatura (funció pura).
   */
  function componCorreu(parts, escenari) {
    var nom = String((escenari && escenari.interlocutor) || '').split(',')[0].trim();
    var salutacio = netejaText(parts.salutacio || '');
    var paragrafs = (parts.paragrafs || []).map(function (p) { return netejaText(p); })
      .filter(function (p) { return p; });
    var comiat = netejaText(parts.comiat || '').split('\n')[0].trim();
    // Si el model hi ha posat el nom ("Salutacions, Laura Vidal"), es treu:
    // la signatura ja el porta.
    if (nom && comiat.indexOf(nom) !== -1) {
      comiat = comiat.slice(0, comiat.indexOf(nom)).trim();
    }
    var tancament = [comiat, signatura(escenari)].filter(function (l) { return l; }).join('\n');
    return [salutacio, paragrafs.join('\n\n'), tancament].filter(function (b) { return b; }).join('\n\n');
  }

  /**
   * Interpreta la resposta HTTP (funció pura). Llança errors amb
   * `reintentable` segons el tipus de fallada. `escenari` dona la signatura.
   */
  function interpretaResposta(codi, cos, escenari) {
    if (codi === 429 || codi >= 500) {
      throw ProveidorIA.errorIA('Gemini no disponible o quota exhaurida (HTTP ' + codi + '): ' + missatgeErrorApi_(cos), true, 'HTTP_' + codi);
    }
    if (codi < 200 || codi >= 300) {
      throw ProveidorIA.errorIA('Gemini ha rebutjat la petició (HTTP ' + codi + '): ' + missatgeErrorApi_(cos), false, 'HTTP_' + codi);
    }
    var json;
    try {
      json = JSON.parse(cos);
    } catch (e) {
      throw ProveidorIA.errorIA('Resposta de Gemini no és JSON vàlid.', true, 'FORMAT');
    }
    if (json.status && json.status !== 'completed') {
      throw ProveidorIA.errorIA('La interacció de Gemini no s\'ha completat (estat: ' + json.status + ').', true, 'ESTAT');
    }
    var text = extreuText_(json).trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    if (!text) {
      throw ProveidorIA.errorIA('Gemini ha retornat una resposta buida.', true, 'SORTIDA_BUIDA');
    }
    var estructurat;
    try {
      estructurat = JSON.parse(text);
    } catch (e) {
      throw ProveidorIA.errorIA('La sortida de Gemini no segueix el format JSON demanat.', true, 'SORTIDA_INVALIDA');
    }
    if (!estructurat || typeof estructurat.finalitzada !== 'boolean') {
      throw ProveidorIA.errorIA('La sortida de Gemini no indica si la conversa ha finalitzat ("finalitzada").', true, 'SORTIDA_INVALIDA');
    }
    if (Array.isArray(estructurat.paragrafs)) {
      return { text: componCorreu(estructurat, escenari), finalitzada: estructurat.finalitzada };
    }
    // Format anterior: tot el correu en un sol camp.
    if (typeof estructurat.resposta === 'string') {
      return { text: netejaText(estructurat.resposta), finalitzada: estructurat.finalitzada };
    }
    throw ProveidorIA.errorIA('La sortida de Gemini no té el camp "paragrafs".', true, 'SORTIDA_INVALIDA');
  }

  function genera(context) {
    var model = Config.llegeix().model;
    if (!model) throw ProveidorIA.errorIA('Falta la propietat GEMINI_MODEL.', false, 'CONFIG');
    var peticio = construeixPeticio(model, Indicacions.construeix(context));
    var resposta;
    try {
      resposta = UrlFetchApp.fetch(URL_BASE + '/interactions', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-goog-api-key': Config.clauApi(), 'Api-Revision': API_REVISION },
        payload: JSON.stringify(peticio),
        muteHttpExceptions: true
      });
    } catch (e) {
      throw ProveidorIA.errorIA('No s\'ha pogut contactar amb Gemini: ' + Registre.resumError(e), true, 'XARXA');
    }
    var resultat = interpretaResposta(resposta.getResponseCode(), resposta.getContentText(), context.escenari);
    return { text: resultat.text, finalitzada: resultat.finalitzada, proveidor: PROVEIDOR, model: model };
  }

  /** Comprova que el model configurat existeix (no consumeix generació). */
  function comprovaModel() {
    var model = Config.llegeix().model;
    var resposta = UrlFetchApp.fetch(URL_BASE + '/models/' + encodeURIComponent(model), {
      method: 'get',
      headers: { 'x-goog-api-key': Config.clauApi() },
      muteHttpExceptions: true
    });
    var codi = resposta.getResponseCode();
    if (codi === 200) return { correcte: true, detall: 'Model accessible: ' + model };
    return { correcte: false, detall: 'HTTP ' + codi + ': ' + missatgeErrorApi_(resposta.getContentText()) };
  }

  return {
    API_REVISION: API_REVISION,
    URL_BASE: URL_BASE,
    construeixPeticio: construeixPeticio,
    interpretaResposta: interpretaResposta,
    netejaText: netejaText,
    signatura: signatura,
    componCorreu: componCorreu,
    genera: genera,
    comprovaModel: comprovaModel
  };
})();
