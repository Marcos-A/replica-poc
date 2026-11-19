/**
 * Registres tècnics (Cloud Logging / "Execucions" de l'editor).
 *
 * El mòdul es diu Registre per no trepitjar el servei integrat Logger
 * d'Apps Script. Emmascara adreces de correu i qualsevol cadena amb
 * aparença de clau d'API abans d'escriure.
 */
var Registre = (function () {
  var PATRO_CLAU = /AIza[0-9A-Za-z_\-]{20,}/g;
  var PATRO_CORREU = /([A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]*@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})/g;

  /** "docent@centre.cat" → "d***@centre.cat" */
  function emmascaraCorreu(text) {
    return String(text).replace(PATRO_CORREU, '$1***@$2');
  }

  function sanititza(text) {
    return emmascaraCorreu(String(text).replace(PATRO_CLAU, '[clau-ocultada]'));
  }

  function escriu_(nivell, missatge, dades) {
    var linia = '[' + nivell + '] ' + missatge;
    if (dades !== undefined) {
      var serialitzat;
      try {
        serialitzat = JSON.stringify(dades);
      } catch (e) {
        serialitzat = String(dades);
      }
      linia += ' ' + serialitzat;
    }
    linia = sanititza(linia);
    if (nivell === 'ERROR') {
      console.error(linia);
    } else if (nivell === 'AVÍS') {
      console.warn(linia);
    } else {
      console.log(linia);
    }
    return linia;
  }

  /** Resum curt d'un error per desar a la columna darrer_error. */
  function resumError(error) {
    var text = error && error.message ? error.message : String(error);
    return sanititza(text).slice(0, 300);
  }

  return {
    info: function (missatge, dades) { return escriu_('INFO', missatge, dades); },
    avis: function (missatge, dades) { return escriu_('AVÍS', missatge, dades); },
    error: function (missatge, dades) { return escriu_('ERROR', missatge, dades); },
    emmascaraCorreu: emmascaraCorreu,
    sanititza: sanititza,
    resumError: resumError
  };
})();
