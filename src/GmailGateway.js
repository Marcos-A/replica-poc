/**
 * Accés a Gmail. Converteix els objectes de GmailApp en descriptors simples
 * perquè la lògica de conversa no depengui de l'API de Gmail.
 *
 * Només es llegeix el text pla dels missatges: no es processen adjunts ni HTML.
 */
var Bustia = (function () {
  var PATRO_REMITENT_AUTOMATIC = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?|notifications?)([+.\-_@]|$)/i;
  var PATRO_ASSUMPTE_AUTOMATIC = /^(resposta autom[aà]tica|automatic reply|auto[- ]?reply|out of office|fora de l'oficina|respuesta autom[aá]tica|fuera de la oficina|delivery status notification|undeliver(able|ed)|mail delivery (failed|subsystem)|no s'ha pogut lliurar|no se ha podido entregar|returned mail)/i;

  /** Extreu l'adreça d'una capçalera From: "Nom <a@b.cat>" → "a@b.cat". */
  function extreuAdreca(from) {
    var text = String(from || '');
    var coincidencia = text.match(/<([^>]+)>/);
    var adreca = coincidencia ? coincidencia[1] : text;
    return Config.normalitzaCorreu(adreca.replace(/^"+|"+$/g, ''));
  }

  /**
   * Detecta respostes automàtiques, notificacions de no lliurament i
   * enviaments massius. `capcalera(nom)` retorna '' si no existeix.
   */
  function esAutomatic(descriptor) {
    var adreca = descriptor.adreca || '';
    var local = adreca.split('@')[0];
    if (PATRO_REMITENT_AUTOMATIC.test(local + '@')) return true;
    if (PATRO_ASSUMPTE_AUTOMATIC.test(String(descriptor.assumpte || '').replace(/^(re|fw|fwd|rv|res)\s*:\s*/i, '').trim())) return true;
    var capcalera = descriptor.capcalera || function () { return ''; };
    var autoSubmitted = String(capcalera('Auto-Submitted') || '').trim().toLowerCase();
    if (autoSubmitted && autoSubmitted !== 'no') return true;
    var precedence = String(capcalera('Precedence') || '').trim().toLowerCase();
    if (['bulk', 'junk', 'list', 'auto_reply'].indexOf(precedence) !== -1) return true;
    if (capcalera('X-Autoreply') || capcalera('X-Autorespond') || capcalera('X-Failed-Recipients')) return true;
    if (/multipart\/report/i.test(String(capcalera('Content-Type') || ''))) return true;
    return false;
  }

  /**
   * Cert si la línia `i` comença una capçalera de cita "Missatge de … del dia
   * …:" que acaba, com a molt, tres línies més avall.
   */
  function esCapcaleraMissatgeDe_(linies, i) {
    var text = '';
    for (var k = i; k < Math.min(linies.length, i + 4); k++) {
      text += (text ? ' ' : '') + linies[k].trim();
      if (/\sdel d[ií]a\s[\s\S]*:$/i.test(text)) return true;
    }
    return false;
  }

  /**
   * Neteja el text pla d'una resposta: elimina el text citat, les
   * signatures habituals i les línies "Enviat des del meu mòbil".
   */
  function netejaCos(text, maxCaracters) {
    var linies = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var tall = linies.length;
    var MARCA_CITA = /(va escriure|escribi[oó]|wrote|a [eé]crit|schrieb|ha scritto)\s*:\s*$/i;
    var INICI_CITA = /^\s*(El|On|Le|Am|Il|L')\s/i;
    for (var i = 0; i < linies.length; i++) {
      var l = linies[i];
      if (MARCA_CITA.test(l)) {
        tall = (i > 0 && INICI_CITA.test(linies[i - 1]) && !INICI_CITA.test(l)) ? i - 1 : i;
        break;
      }
      if (/^\s*-{2,}\s*(original message|missatge original|mensaje original|forwarded message|missatge reenviat|mensaje reenviado)\s*-{2,}/i.test(l)) {
        tall = i;
        break;
      }
      // Gmail en català i castellà: "Missatge de Nom <a@b.cat> del dia dj., 19 de
      // nov. 2026 a les 17:26:" (sovint partit en diverses línies).
      if (/^\s*(Missatge|Mensaje) de\s/i.test(l) && esCapcaleraMissatgeDe_(linies, i)) { tall = i; break; }
      if (/^_{10,}\s*$/.test(l)) { tall = i; break; }
      if (/^\s*(De|From)\s*:\s*\S/.test(l) &&
          linies.slice(i + 1, i + 4).some(function (s) { return /^\s*(Enviat|Enviado|Sent|Data|Fecha|Date|Per a|Para|To)\s*:/i.test(s); })) {
        tall = i;
        break;
      }
      if (/^-- ?$/.test(l)) { tall = i; break; }
    }
    var net = linies.slice(0, tall)
      .filter(function (l) { return !/^\s*>/.test(l); })
      .filter(function (l) { return !/^\s*(enviat des del meu|enviado desde mi|sent from my|obtenir outlook|get outlook)/i.test(l); })
      .join('\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    var max = maxCaracters || Config.LIMITS.MAX_CARACTERS_MISSATGE_ENTRANT;
    if (net.length > max) net = net.slice(0, max) + ' […]';
    return net;
  }

  /** Adreces de la pròpia bústia (usuari efectiu i àlies). */
  function adrecesPropies() {
    var propies = [Config.normalitzaCorreu(Session.getEffectiveUser().getEmail())];
    try {
      GmailApp.getAliases().forEach(function (a) { propies.push(Config.normalitzaCorreu(a)); });
    } catch (e) {
      Registre.avis('No s\'han pogut llegir els àlies de Gmail', { error: Registre.resumError(e) });
    }
    return propies.filter(function (a) { return a; });
  }

  /** Envia el primer missatge i retorna els identificadors reals de Gmail. */
  function enviaInicial(destinatari, assumpte, cos, nomVisible) {
    var opcions = nomVisible ? { name: nomVisible } : {};
    var esborrany = GmailApp.createDraft(destinatari, assumpte, cos, opcions);
    var enviat = esborrany.send();
    return { threadId: enviat.getThread().getId(), messageId: enviat.getId() };
  }

  /**
   * Respon dins del mateix fil al missatge indicat (del participant).
   * Retorna l'identificador del missatge enviat.
   */
  function respon(threadId, idMissatgeOrigen, cos, nomVisible) {
    var fil = GmailApp.getThreadById(threadId);
    if (!fil) throw new Error('No s\'ha trobat el fil de Gmail.');
    var origen = null;
    fil.getMessages().forEach(function (m) {
      if (m.getId() === idMissatgeOrigen) origen = m;
    });
    if (!origen) throw new Error('No s\'ha trobat el missatge a què s\'havia de respondre.');
    var opcions = nomVisible ? { name: nomVisible } : {};
    var enviat = origen.createDraftReply(cos, opcions).send();
    if (enviat.getThread().getId() !== threadId) {
      Registre.avis('La resposta ha quedat en un fil diferent', { threadEsperat: threadId });
    }
    return { messageId: enviat.getId() };
  }

  /**
   * Llegeix un fil i retorna descriptors dels missatges, en ordre cronològic.
   * Per als missatges ja coneguts (idsConeguts) no es consulten capçaleres.
   */
  function llegeixFil(threadId, idsConeguts, propies) {
    var fil = GmailApp.getThreadById(threadId);
    if (!fil) throw new Error('No s\'ha trobat el fil de Gmail.');
    var coneguts = idsConeguts || {};
    var adrecesPropiesLlista = propies || adrecesPropies();
    return fil.getMessages()
      .filter(function (m) { return !m.isDraft() && !m.isInTrash(); })
      .map(function (m) {
        var id = m.getId();
        var adreca = extreuAdreca(m.getFrom());
        var d = {
          id: id,
          adreca: adreca,
          data: m.getDate(),
          conegut: Object.prototype.hasOwnProperty.call(coneguts, id),
          propi: adrecesPropiesLlista.indexOf(adreca) !== -1
        };
        if (!d.conegut && !d.propi) {
          d.assumpte = m.getSubject();
          d.automatic = esAutomatic({
            adreca: adreca,
            assumpte: d.assumpte,
            capcalera: function (nom) { return m.getHeader(nom); }
          });
          d.cos = netejaCos(m.getPlainBody());
        }
        return d;
      })
      .sort(function (a, b) { return a.data.getTime() - b.data.getTime(); });
  }

  /**
   * Cerca a "Enviats" un missatge inicial que potser es va enviar abans
   * d'una interrupció. Retorna { threadId, messageId } o null.
   */
  function cercaEnviat(destinatari, assumpte, desDe) {
    var segons = Math.floor(new Date(desDe).getTime() / 1000) - 60;
    var consulta = 'in:sent to:' + destinatari +
      ' subject:"' + String(assumpte).replace(/"/g, '') + '" after:' + segons;
    var fils = GmailApp.search(consulta, 0, 5);
    var candidat = null;
    fils.forEach(function (f) {
      f.getMessages().forEach(function (m) {
        if (candidat || m.isDraft()) return;
        if (m.getSubject() === assumpte && m.getDate().getTime() >= segons * 1000 &&
            String(m.getTo()).toLowerCase().indexOf(Config.normalitzaCorreu(destinatari)) !== -1) {
          candidat = { threadId: f.getId(), messageId: m.getId() };
        }
      });
    });
    return candidat;
  }

  /** Comprovació d'accés per a comprovaConfiguracio(). */
  function diagnostica() {
    return {
      adreca: Session.getEffectiveUser().getEmail(),
      noLlegits: GmailApp.getInboxUnreadCount()
    };
  }

  return {
    extreuAdreca: extreuAdreca,
    esAutomatic: esAutomatic,
    netejaCos: netejaCos,
    adrecesPropies: adrecesPropies,
    enviaInicial: enviaInicial,
    respon: respon,
    llegeixFil: llegeixFil,
    cercaEnviat: cercaEnviat,
    diagnostica: diagnostica
  };
})();
