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

  var ESQUEMA_SORTIDA = {
    type: 'object',
    properties: {
      resposta: {
        type: 'string',
        description: 'Text complet del correu de resposta, en text pla.'
      },
      finalitzada: {
        type: 'boolean',
        description: 'true només si aquest missatge tanca la situació.'
      }
    },
    required: ['resposta', 'finalitzada'],
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
   * Interpreta la resposta HTTP (funció pura). Llança errors amb
   * `reintentable` segons el tipus de fallada.
   */
  function interpretaResposta(codi, cos) {
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
    if (!estructurat || typeof estructurat.resposta !== 'string' || typeof estructurat.finalitzada !== 'boolean') {
      throw ProveidorIA.errorIA('La sortida de Gemini no té els camps "resposta" i "finalitzada".', true, 'SORTIDA_INVALIDA');
    }
    return { text: netejaText(estructurat.resposta), finalitzada: estructurat.finalitzada };
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
    var resultat = interpretaResposta(resposta.getResponseCode(), resposta.getContentText());
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
    genera: genera,
    comprovaModel: comprovaModel
  };
})();
