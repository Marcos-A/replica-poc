/**
 * Menú «Rèplica» del full de càlcul. Només funciona si el projecte està
 * vinculat al full (instal·lat des d'Extensions › Apps Script).
 *
 * - onOpen és un activador simple: s'executa sense autorització i només
 *   construeix el menú. Si no pot llegir l'interruptor, mostra les dues
 *   opcions (activar i aturar).
 * - Cada opció s'executa amb el compte de qui hi fa clic. Abans de fer res,
 *   comprova que és el compte de prova (Compte.comprova) i, si no, ho explica.
 * - Els resultats i els errors es mostren en un quadre de diàleg en català.
 *   Les adreces dels registres i dels errors surten emmascarades.
 */
var Menu = (function () {
  var TITOL_MENU = 'Rèplica';

  /** Construeix (o reconstrueix) el menú. */
  function crea() {
    var ui = SpreadsheetApp.getUi();
    var activada = null;
    try {
      activada = Config.llegeix().simulacioActivada;
    } catch (e) { /* activador simple sense accés a les propietats */ }

    var menu = ui.createMenu(TITOL_MENU)
      .addItem('Envia l\'activació seleccionada…', 'menuEnviaActivacio')
      .addItem('Revisa ara les respostes', 'menuRevisaAra')
      .addSeparator()
      .addItem('Atura la conversa seleccionada…', 'menuAturaConversa')
      .addItem('Reactiva la conversa seleccionada…', 'menuReactivaConversa')
      .addItem('Reobre la conversa seleccionada…', 'menuReobreConversa')
      .addItem('Estat de les converses', 'menuEstatConverses')
      .addSeparator();
    if (activada === true) {
      menu.addItem('Simulacions ACTIVADES · Atura-les totes…', 'menuAturaSimulacions');
    } else if (activada === false) {
      menu.addItem('Simulacions ATURADES · Activa-les…', 'menuActivaSimulacions');
    } else {
      menu.addItem('Activa les simulacions…', 'menuActivaSimulacions')
        .addItem('Atura totes les simulacions…', 'menuAturaSimulacions');
    }
    menu.addSubMenu(ui.createMenu('Revisió automàtica')
      .addItem('Crea o actualitza', 'menuCreaDisparador')
      .addItem('Elimina…', 'menuEliminaDisparadors'))
      .addSubMenu(ui.createMenu('Configuració')
        .addItem('Comprova la configuració', 'menuComprovaConfiguracio')
        .addItem('Prepara el full', 'menuPreparaFull')
        .addItem('Desa la clau de Gemini…', 'menuDesaClauGemini'))
      .addToUi();
  }

  /**
   * Cert només si se sap segur que qui obre el full no és el compte de
   * prova. En un activador simple, Google sovint no dona l'adreça (comptes
   * de Gmail): llavors el menú es mostra i la comprovació es fa en clicar.
   */
  function esUnAltreCompte() {
    try {
      var actual = Config.normalitzaCorreu(Session.getActiveUser().getEmail());
      var usuari = SpreadsheetApp.getActiveSpreadsheet().getOwner();
      var propietari = usuari ? Config.normalitzaCorreu(usuari.getEmail()) : '';
      return actual !== '' && propietari !== '' && actual !== propietari;
    } catch (e) {
      return false;
    }
  }

  /**
   * Executa una opció del menú: comprova el codi i el compte, i mostra
   * qualsevol error en un diàleg. `accio(ui)` mostra el seu propi resultat.
   */
  function executa(titol, accio) {
    var ui = SpreadsheetApp.getUi();
    try {
      exigeixModuls_();
      var compte = Compte.comprova();
      if (!compte.correcte) {
        avisa_(ui, titol, Registre.sanititza(compte.codi === Compte.CODIS.SENSE_FULL
          ? textSenseFull_(compte) : compte.missatge));
        return;
      }
      accio(ui);
    } catch (e) {
      avisa_(ui, titol, 'No s\'ha pogut completar.\n\n' + Registre.sanititza(e && e.message ? e.message : String(e)));
    }
  }

  /**
   * El menú només existeix dins del full: si el programa no el pot obrir, és
   * que s'executa amb un compte que no hi té accés (sovint, un altre compte
   * del navegador). Suggerir SPREADSHEET_ID aquí confondria.
   */
  function textSenseFull_(compte) {
    return 'El programa no ha pogut obrir aquest full amb el compte ' +
      (compte.actual ? compte.actual + ' ' : '') + 'amb què s\'està executant.\n\n' +
      'Només el compte de prova, propietari del full, pot fer servir el menú Rèplica. Compartir el full, ' +
      'encara que sigui amb permís d\'edició, permet veure\'l i modificar-lo, però no enviar activacions ni ' +
      'revisar respostes: els correus sortirien del Gmail de qui fa clic.\n\n' +
      'Si heu entrat amb el compte de prova: passa sovint quan al navegador hi ha més d\'un compte de Google ' +
      'obert, perquè Google executa el programa amb el compte principal. Obriu el full en una finestra ' +
      'd\'incògnit havent entrat només amb el compte de prova.\n\n' +
      'Detall: ' + compte.missatge;
  }

  function avisa_(ui, titol, text) {
    ui.alert(titol, text, ui.ButtonSet.OK);
  }

  function confirma_(ui, titol, text) {
    return ui.alert(titol, text, ui.ButtonSet.YES_NO) === ui.Button.YES;
  }

  // ---------------------------------------------------------- Opcions

  // Noms diferents de les funcions globals que criden (preparaFulls...):
  // una funció local amb el mateix nom les amagaria.
  function enviaActivacio() {
    var TITOL = 'Envia l\'activació seleccionada';
    executa(TITOL, function (ui) {
      var llibre = SpreadsheetApp.getActiveSpreadsheet();
      var rang = llibre ? llibre.getActiveRange() : null;
      var sel = Repositori.activacioDeLaSeleccio(rang ? rang.getSheet() : null, rang);
      if (sel.error) {
        avisa_(ui, TITOL, sel.error);
        return;
      }
      var a = sel.activacio;
      // Es mostren les adreces completes: cal saber exactament quina falla.
      var revisio = revisaActivacio_(a);
      if (revisio.error) {
        avisa_(ui, TITOL, revisio.error);
        return;
      }
      var textOmesos = revisio.omesos.length ? '\n\nNo s\'enviarà a:\n' + revisio.omesos.map(function (o) {
        return '• ' + o.correu + ' (' + o.motiu + ')';
      }).join('\n') : '';
      if (revisio.aEnviar.length === 0) {
        avisa_(ui, TITOL, 'No cal enviar res.' + textOmesos);
        return;
      }
      var text = 'Activació: ' + (a.id_activacio || 'nova (fila ' + a.fila + ')') + '\n' +
        'Escenari: ' + revisio.escenari.id + ' · ' + revisio.escenari.titol + '\n\n' +
        'S\'enviarà el correu inicial de la clienta a ' + revisio.aEnviar.length + ' persona(es), cadascuna en un ' +
        'fil separat (ningú no veu les altres adreces):\n• ' + revisio.aEnviar.join('\n• ') + textOmesos +
        '\n\nVoleu enviar-lo?';
      if (!confirma_(ui, TITOL, text)) return;
      var r = enviaActivacio_(a);
      var resum = (r.errors.length ? 'Enviament incomplet.' : 'Fet.') + '\n\nActivació: ' + r.idActivacio +
        '\nCorreus enviats: ' + r.enviats.length;
      if (r.errors.length) {
        resum += '\n\nNo s\'ha pogut enviar a:\n' + r.errors.map(function (o) {
          return '• ' + o.correu + ': ' + o.motiu;
        }).join('\n') + '\n\nQuan ho hàgiu resolt, torneu a enviar la mateixa fila: només s\'enviarà a qui falti.';
      }
      resum += '\n\nEl resultat també és a la fila de l\'activació (columna resultat), i les converses noves, ' +
        'a la pestanya Converses.';
      avisa_(ui, TITOL, resum);
    });
  }

  function revisaAra() {
    var TITOL = 'Revisa ara les respostes';
    executa(TITOL, function (ui) {
      var r = processaCorreusPendents();
      var text;
      if (r.estat === 'DESACTIVADA') {
        text = 'Les simulacions estan aturades: no s\'ha revisat res.';
      } else if (r.estat === 'BLOQUEJAT') {
        text = 'Ara mateix hi ha una altra revisió en curs. Torneu-ho a provar d\'aquí a un minut.';
      } else if (r.estat === 'COMPTE_INCORRECTE') {
        text = Registre.sanititza(r.missatge);
      } else if (r.revisades === 0) {
        text = 'No hi ha cap conversa activa.';
      } else {
        text = 'Revisió feta.\n\nConverses revisades: ' + r.revisades + '\nRespostes enviades: ' + r.respostes +
          (r.errors ? '\nConverses amb error: ' + r.errors + ' (vegeu la columna darrer_error de la pestanya Converses)' : '') +
          (r.ajornades ? '\nPendents per a la propera revisió: ' + r.ajornades : '') +
          (r.limitDiari ? '\n\nRespostes en espera pel límit de correus diari: ' + r.limitDiari + '. S\'enviaran ' +
            'soles quan hi torni a haver marge (fila correus_per_dia de la pestanya Configuració).' : '');
      }
      avisa_(ui, TITOL, text);
    });
  }

  /** Conversa de la fila seleccionada, o null després d'explicar què cal fer. */
  function conversaSeleccionada_(ui, titol) {
    var llibre = SpreadsheetApp.getActiveSpreadsheet();
    var rang = llibre ? llibre.getActiveRange() : null;
    var r = Repositori.conversaDeLaSeleccio(rang ? rang.getSheet() : null, rang);
    if (r.error) {
      avisa_(ui, titol, r.error);
      return null;
    }
    return r.conversa;
  }

  function descriuConversa_(c) {
    return 'Conversa: ' + c.id_conversa + '\nParticipant: ' + c.correu_participant + '\nEscenari: ' + c.id_escenari +
      '\nEstat: ' + c.estat + '\nRespostes de la clienta: ' + c.torns_ia +
      (c.darrer_error ? '\nDarrer error: ' + Registre.sanititza(c.darrer_error) : '');
  }

  function aturaConversa() {
    var TITOL = 'Atura la conversa seleccionada';
    executa(TITOL, function (ui) {
      var c = conversaSeleccionada_(ui, TITOL);
      if (!c) return;
      if (c.estat === Repositori.ESTATS_CONVERSA.FINALITZADA) {
        avisa_(ui, TITOL, 'Aquesta conversa ja està finalitzada: no cal fer res.\n\n' + descriuConversa_(c));
        return;
      }
      if (!confirma_(ui, TITOL, descriuConversa_(c) + '\n\nLa conversa passarà a FINALITZADA sense enviar cap ' +
          'comiat. Si el participant hi torna a respondre, no rebrà resposta (fins que la reobriu amb «Reobre la ' +
          'conversa seleccionada»).\n\nVoleu aturar-la?')) return;
      tancaConversa(c.id_conversa);
      avisa_(ui, TITOL, 'Conversa ' + c.id_conversa + ' aturada (FINALITZADA).');
    });
  }

  function reactivaConversaSeleccionada() {
    var TITOL = 'Reactiva la conversa seleccionada';
    executa(TITOL, function (ui) {
      var c = conversaSeleccionada_(ui, TITOL);
      if (!c) return;
      if (c.estat !== Repositori.ESTATS_CONVERSA.ERROR) {
        avisa_(ui, TITOL, 'Només es poden reactivar les converses en estat ERROR. Aquesta és en estat ' + c.estat +
          '.\n\n' + descriuConversa_(c));
        return;
      }
      if (!confirma_(ui, TITOL, descriuConversa_(c) + '\n\nABANS DE CONTINUAR: obriu el fil a la bústia de prova ' +
          '(Gmail) i comproveu que la darrera resposta de la clienta NO s\'ha enviat.\n' +
          '• Si no s\'ha enviat: reactiveu-la, i la clienta respondrà a la propera revisió.\n' +
          '• Si sí que s\'ha enviat: no la reactiveu (es duplicaria). Feu servir «Atura la conversa seleccionada».\n\n' +
          'Voleu reactivar-la?')) return;
      reactivaConversa(c.id_conversa);
      avisa_(ui, TITOL, 'Conversa ' + c.id_conversa + ' reactivada (ACTIVA). La clienta respondrà a la propera ' +
        'revisió automàtica, o ara mateix si feu Rèplica › Revisa ara les respostes.');
    });
  }

  function reobreConversaSeleccionada() {
    var TITOL = 'Reobre la conversa seleccionada';
    executa(TITOL, function (ui) {
      var c = conversaSeleccionada_(ui, TITOL);
      if (!c) return;
      if (c.estat !== Repositori.ESTATS_CONVERSA.FINALITZADA) {
        avisa_(ui, TITOL, 'Només es poden reobrir les converses finalitzades. Aquesta és en estat ' + c.estat + '.' +
          (c.estat === Repositori.ESTATS_CONVERSA.ERROR ? ' Per a les converses en ERROR, feu servir «Reactiva la conversa seleccionada».' : '') +
          '\n\n' + descriuConversa_(c));
        return;
      }
      var perDefecte = Config.LIMITS.RESPOSTES_EXTRA_PER_DEFECTE;
      var maxim = Config.LIMITS.MAX_RESPOSTES_EXTRA;
      var resposta = ui.prompt(TITOL, descriuConversa_(c) + '\n\nQuantes respostes més pot enviar la clienta en aquesta ' +
        'conversa? Escriviu un nombre de 1 a ' + maxim + ', o deixeu-ho en blanc per a ' + perDefecte + '.\n\n' +
        'Si el participant ha escrit mentre la conversa era tancada, la clienta li respondrà a la propera revisió.',
        ui.ButtonSet.OK_CANCEL);
      if (resposta.getSelectedButton() !== ui.Button.OK) return;
      var text = String(resposta.getResponseText() || '').trim();
      var extra = text === '' ? perDefecte : Number(text);
      if (!(Math.floor(extra) === extra && extra >= 1 && extra <= maxim)) {
        avisa_(ui, TITOL, '«' + text + '» no és vàlid: escriviu un nombre de 1 a ' + maxim + '. No s\'ha canviat res.');
        return;
      }
      var r = reobreConversa(c.id_conversa, extra);
      avisa_(ui, TITOL, 'Conversa ' + c.id_conversa + ' reoberta (ACTIVA). La clienta pot enviar ' + extra +
        ' resposta(es) més (fins a ' + r.maxTorns + ' en total).\n\nSi el participant ja hi havia escrit, la clienta ' +
        'respondrà a la propera revisió automàtica, o ara mateix si feu Rèplica › Revisa ara les respostes. Si no, ' +
        'esperarà el seu proper correu.');
    });
  }

  function estatConverses() {
    var TITOL = 'Estat de les converses';
    executa(TITOL, function (ui) {
      avisa_(ui, TITOL, estatSimulacions().text);
    });
  }

  function activa() {
    var TITOL = 'Activa les simulacions';
    executa(TITOL, function (ui) {
      if (Config.llegeix().simulacioActivada) {
        avisa_(ui, TITOL, 'Les simulacions ja estaven activades.');
        crea();
        return;
      }
      if (!confirma_(ui, TITOL, 'Feu-ho només quan el coordinador ho hagi confirmat.\n\nA partir d\'ara, la clienta ' +
          'respondrà automàticament als participants i es podran iniciar simulacions noves.\n\nVoleu activar-les?')) return;
      activaSimulacions();
      crea();
      avisa_(ui, TITOL, 'Simulacions activades.' + (Disparador.compta() === 0
        ? '\n\nAtenció: encara no hi ha revisió automàtica, i les respostes no arribaran soles. Creeu-la amb ' +
          'Rèplica › Revisió automàtica › Crea o actualitza.' : ''));
    });
  }

  function atura() {
    var TITOL = 'Atura totes les simulacions';
    executa(TITOL, function (ui) {
      if (!confirma_(ui, TITOL, 'S\'aturarà tot de seguida: no es respondrà a ningú ni es podran iniciar simulacions ' +
          'noves fins que les torneu a activar. Les converses no es perden.\n\nVoleu aturar-ho tot?')) return;
      aturaSimulacions();
      crea();
      avisa_(ui, TITOL, 'Simulacions aturades. Per tornar-les a engegar: Rèplica › Simulacions ATURADES · Activa-les.');
    });
  }

  function creaRevisio() {
    var TITOL = 'Revisió automàtica';
    executa(TITOL, function (ui) {
      var interval = creaDisparador();
      avisa_(ui, TITOL, 'Revisió automàtica creada: la bústia es revisarà cada ' + interval + ' minut(s).\n\n' +
        'Per canviar-ho, trieu un altre valor a interval_minuts (pestanya Configuració): s\'aplica sol.' +
        (Config.llegeix().simulacioActivada ? ''
          : '\n\nRecordeu que, mentre les simulacions estiguin aturades, la revisió no fa res.'));
    });
  }

  function eliminaRevisio() {
    var TITOL = 'Elimina la revisió automàtica';
    executa(TITOL, function (ui) {
      if (!confirma_(ui, TITOL, 'La bústia deixarà de revisar-se sola i les clientes no respondran fins que la ' +
          'torneu a crear.\n\nVoleu eliminar-la?')) return;
      var n = eliminaDisparadors();
      avisa_(ui, TITOL, n ? 'Revisió automàtica eliminada.' : 'No hi havia cap revisió automàtica.');
    });
  }

  function comprova() {
    executa('Comprova la configuració', function (ui) {
      var r = comprovaConfiguracio();
      avisa_(ui, r.correcte ? 'Configuració correcta' : 'Cal corregir alguna cosa',
        (r.correcte ? 'Tot correcte. Les línies [AVÍS] i [INFO] són informatives.\n\n'
          : 'Corregiu les línies [ERROR] i torneu a comprovar-ho.\n\n') + r.text);
    });
  }

  function preparaFull() {
    executa('Prepara el full', function (ui) {
      var canvis = preparaFulls();
      avisa_(ui, 'Prepara el full', canvis.length ? 'Fet. Canvis:\n• ' + canvis.join('\n• ')
        : 'Tot ja estava preparat; no s\'ha canviat res.');
    });
  }

  function desaClauGemini() {
    var TITOL = 'Desa la clau de Gemini';
    executa(TITOL, function (ui) {
      var resposta = ui.prompt(TITOL, 'Enganxeu aquí la clau de Gemini (comença per AIza…).\n\n' +
        'Es desarà al compte de prova, on no la veuen les altres persones que editen el full. Si era a les ' +
        'Propietats de l\'script, s\'hi esborrarà.', ui.ButtonSet.OK_CANCEL);
      if (resposta.getSelectedButton() !== ui.Button.OK) return;
      if (!String(resposta.getResponseText() || '').trim()) {
        avisa_(ui, TITOL, 'No heu enganxat cap clau: no s\'ha canviat res.');
        return;
      }
      var r = Config.desaClau(resposta.getResponseText());
      var text = 'Clau desada.' + (r.esborradaDeScript ? ' S\'ha esborrat de les Propietats de l\'script.' : '');
      if (Config.llegeix().model) {
        try {
          var model = Gemini.comprovaModel();
          text += model.correcte ? '\n\nComprovació amb Gemini: correcta.'
            : '\n\nComprovació amb Gemini: ' + Registre.sanititza(model.detall);
        } catch (e) {
          text += '\n\nNo s\'ha pogut comprovar amb Gemini: ' + Registre.resumError(e);
        }
      }
      avisa_(ui, TITOL, text);
    });
  }

  return {
    crea: crea,
    esUnAltreCompte: esUnAltreCompte,
    executa: executa,
    enviaActivacio: enviaActivacio,
    revisaAra: revisaAra,
    aturaConversa: aturaConversa,
    reactivaConversa: reactivaConversaSeleccionada,
    reobreConversa: reobreConversaSeleccionada,
    estatConverses: estatConverses,
    activa: activa,
    atura: atura,
    creaRevisio: creaRevisio,
    eliminaRevisio: eliminaRevisio,
    comprova: comprova,
    preparaFull: preparaFull,
    desaClauGemini: desaClauGemini
  };
})();

/**
 * Activador simple: afegeix el menú «Rèplica» en obrir el full. No el mostra
 * a qui se sap que no és el compte de prova.
 */
function onOpen() {
  if (Menu.esUnAltreCompte()) return;
  Menu.crea();
}

// Funcions que crida el menú (han de ser globals). També es poden executar
// des de l'editor, però els diàlegs només es veuen des del full.
function menuEnviaActivacio() { Menu.enviaActivacio(); }
function menuRevisaAra() { Menu.revisaAra(); }
function menuAturaConversa() { Menu.aturaConversa(); }
function menuReactivaConversa() { Menu.reactivaConversa(); }
function menuReobreConversa() { Menu.reobreConversa(); }
function menuEstatConverses() { Menu.estatConverses(); }
function menuActivaSimulacions() { Menu.activa(); }
function menuAturaSimulacions() { Menu.atura(); }
function menuCreaDisparador() { Menu.creaRevisio(); }
function menuEliminaDisparadors() { Menu.eliminaRevisio(); }
function menuComprovaConfiguracio() { Menu.comprova(); }
function menuPreparaFull() { Menu.preparaFull(); }
function menuDesaClauGemini() { Menu.desaClauGemini(); }
