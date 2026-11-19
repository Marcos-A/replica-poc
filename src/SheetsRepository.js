/**
 * Accés a Google Sheets: sis pestanyes amb capçalera a la fila 1.
 *
 * Quin full: el de la propietat SPREADSHEET_ID si n'hi ha; si no, el full al
 * qual està vinculat el projecte (instal·lat des d'Extensions › Apps Script).
 *
 * - Configuració: paràmetres operatius que el docent pot canviar sense tocar codi.
 * - Participants: qui pot rebre simulacions i a qui es respon (columna actiu).
 * - Activacions: cada fila és un enviament del correu inicial a una o més persones.
 * - Escenaris, Converses i Missatges.
 *
 * Els secrets i l'interruptor general continuen a Script Properties. Els
 * editors del full són també editors del projecte vinculat: la llista de
 * participants és al full perquè la protecció d'ALLOWED_SENDERS ja no ho era.
 *
 * Les pestanyes Activacions, Converses i Missatges tenen format de text pla
 * (@) perquè Sheets no converteixi dates ni identificadors en números.
 */
var Repositori = (function () {
  var FULLS = {
    CONFIGURACIO: 'Configuració',
    PARTICIPANTS: 'Participants',
    ACTIVACIONS: 'Activacions',
    ESCENARIS: 'Escenaris',
    CONVERSES: 'Converses',
    MISSATGES: 'Missatges'
  };

  var COLUMNES = {
    'Configuració': ['clau', 'valor', 'descripcio'],
    Participants: ['correu', 'actiu', 'notes'],
    Activacions: ['id_activacio', 'escenari', 'destinataris', 'estat', 'data_enviament', 'resultat'],
    Escenaris: [
      'id', 'actiu', 'titol', 'interlocutor', 'empresa', 'caracter', 'incidencia',
      'objectiu_interlocutor', 'limits_reservats', 'objectiu_participant', 'criteris',
      'idioma', 'assumpte_inicial', 'missatge_inicial', 'max_torns'
    ],
    Converses: [
      'id_conversa', 'id_escenari', 'correu_participant', 'gmail_thread_id', 'estat',
      'torns_ia', 'data_inici', 'data_actualitzacio', 'darrer_error', 'id_activacio',
      // Límit de respostes d'aquesta conversa quan s'ha reobert; buit = el de l'escenari.
      'max_torns_conversa'
    ],
    // respon_a i tanca_conversa amplien l'especificació: permeten saber quins
    // missatges del participant ja tenen resposta i reconciliar un enviament
    // interromput sense tornar a cridar la IA.
    Missatges: [
      'id_missatge', 'id_conversa', 'gmail_message_id', 'rol', 'data', 'contingut',
      'estat_enviament', 'respon_a', 'tanca_conversa'
    ]
  };

  var FULLS_TEXT = [FULLS.ACTIVACIONS, FULLS.CONVERSES, FULLS.MISSATGES];

  var ESTATS_CONVERSA = {
    ACTIVA: 'ACTIVA',
    PROCESSANT: 'PROCESSANT',
    FINALITZADA: 'FINALITZADA',
    ERROR: 'ERROR'
  };

  var ESTATS_MISSATGE = {
    REBUT: 'REBUT',
    PENDENT: 'PENDENT',
    ENVIAT: 'ENVIAT',
    ERROR: 'ERROR'
  };

  var ESTATS_ACTIVACIO = { ENVIADA: 'ENVIADA', PARCIAL: 'PARCIAL' };

  var ROLS = { PARTICIPANT: 'participant', INTERLOCUTOR: 'interlocutor' };

  /** Paràmetres de la pestanya Configuració, amb valor inicial i explicació. */
  var PARAMETRES = [
    {
      clau: 'interval_minuts',
      valor: 5,
      descripcio: 'Cada quants minuts es revisa la bústia: 1, 5, 10, 15 o 30. El canvi s\'aplica sol a la ' +
        'propera revisió. Amb 1 minut, feu-lo servir només durant les proves: consumeix molta quota diària.'
    },
    {
      clau: 'max_torns_per_defecte',
      valor: 6,
      descripcio: 'Nombre màxim de respostes de la IA per conversa (de 1 a 12) quan l\'escenari no ' +
        'n\'indica cap a la columna max_torns.'
    },
    {
      clau: 'correus_per_dia',
      valor: 100,
      descripcio: 'Correus que la bústia pot enviar en 24 hores: 100 amb un compte de Gmail, 1500 amb un ' +
        'compte de Google Workspace. En arribar-hi, les activacions no s\'envien i les respostes esperen.'
    }
  ];

  /** Paràmetres de versions anteriors: ara són a cada fila d'Activacions. */
  var PARAMETRES_OBSOLETS = ['participant', 'escenari'];

  var llibreEnMemoria_ = null;
  // Error de Google en obrir el full vinculat (p. ex., el compte que executa
  // no hi té accés): es mostra en lloc de suggerir SPREADSHEET_ID.
  var errorVinculat_ = null;

  /** Full al qual està vinculat el projecte, o null si és independent. */
  function llibreVinculat_() {
    try {
      return SpreadsheetApp.getActiveSpreadsheet() || null;
    } catch (e) {
      errorVinculat_ = e;
      return null;
    }
  }

  function llibre_() {
    if (llibreEnMemoria_) return llibreEnMemoria_;
    var id = Config.llegeix().spreadsheetId;
    if (id) {
      llibreEnMemoria_ = SpreadsheetApp.openById(id);
    } else {
      llibreEnMemoria_ = llibreVinculat_();
      if (!llibreEnMemoria_ && errorVinculat_) {
        throw new Error('Google no deixa obrir el full on està instal·lat el programa: ' +
          (errorVinculat_.message || String(errorVinculat_)));
      }
      if (!llibreEnMemoria_) {
        throw new Error('No se sap quin full de càlcul fer servir. Instal·leu el programa des del full ' +
          '(Extensions › Apps Script) o afegiu la propietat SPREADSHEET_ID a les Propietats de l\'script.');
      }
    }
    return llibreEnMemoria_;
  }

  /**
   * D'on surt el full: { vinculat, idVinculat, nomVinculat, idPropietat }.
   * Per a comprovaConfiguracio().
   */
  function origen() {
    var vinculat = llibreVinculat_();
    return {
      vinculat: !!vinculat,
      idVinculat: vinculat ? vinculat.getId() : '',
      nomVinculat: vinculat ? vinculat.getName() : '',
      idPropietat: Config.llegeix().spreadsheetId
    };
  }

  function full_(nom) {
    var full = llibre_().getSheetByName(nom);
    if (!full) {
      throw new Error('No existeix la pestanya "' + nom + '". Feu Rèplica › Configuració › Prepara el full (o executeu preparaFulls).');
    }
    return full;
  }

  /** Evita que un text començat per "=", "+", "-" o "@" s'interpreti com a fórmula. */
  function valorSegur_(valor) {
    if (typeof valor === 'string' && /^[=+\-@]/.test(valor)) return "'" + valor;
    return valor;
  }

  function capcalera_(full) {
    var ultimaColumna = full.getLastColumn();
    if (ultimaColumna === 0) return [];
    return full.getRange(1, 1, 1, ultimaColumna).getValues()[0].map(function (v) {
      return String(v).trim();
    });
  }

  /**
   * Crea les pestanyes i capçaleres que falten, sense esborrar res.
   * Retorna un informe de canvis.
   */
  function preparaFulls(escenariInicial) {
    var llibre = llibre_();
    var canvis = [];
    var creades = {};
    Object.keys(COLUMNES).forEach(function (nom) {
      var full = llibre.getSheetByName(nom);
      if (!full) {
        full = llibre.insertSheet(nom);
        creades[nom] = true;
        canvis.push('Pestanya creada: ' + nom);
      }
      if (FULLS_TEXT.indexOf(nom) !== -1) {
        full.getRange(1, 1, full.getMaxRows(), COLUMNES[nom].length).setNumberFormat('@');
      }
      var actual = capcalera_(full);
      var falten = COLUMNES[nom].filter(function (c) { return actual.indexOf(c) === -1; });
      if (falten.length > 0) {
        var inici = actual.length + 1;
        full.getRange(1, inici, 1, falten.length).setValues([falten]);
        canvis.push('Columnes afegides a ' + nom + ': ' + falten.join(', '));
      }
      full.setFrozenRows(1);
    });

    if (escenariInicial && !escenari(escenariInicial.id)) {
      afegeix_(FULLS.ESCENARIS, escenariInicial);
      canvis.push('Escenari afegit: ' + escenariInicial.id);
    }
    preparaParametres_(llibre, canvis);
    if (creades[FULLS.PARTICIPANTS]) migraRemitents_(canvis);
    preparaValidacions_(llibre);
    eliminaFullsBuitsPerDefecte_(llibre).forEach(function (nom) {
      canvis.push('Pestanya buida eliminada: ' + nom);
    });
    SpreadsheetApp.flush();
    return canvis;
  }

  /**
   * Primera vegada que es crea la pestanya Participants: hi copia les
   * adreces de la propietat obsoleta ALLOWED_SENDERS, marcades com a actives.
   */
  function migraRemitents_(canvis) {
    var adreces = Config.analitzaRemitents(Config.propietat(Config.PROPIETATS.REMITENTS));
    adreces.forEach(function (correu) {
      afegeix_(FULLS.PARTICIPANTS, { correu: correu, actiu: true, notes: '' });
    });
    if (adreces.length) {
      canvis.push('Participants copiats d\'ALLOWED_SENDERS: ' + adreces.length + ' (ja podeu esborrar la propietat)');
    }
  }

  /** Casella de selecció a Participants › actiu i desplegable a Activacions › escenari. */
  function preparaValidacions_(llibre) {
    var participants = llibre.getSheetByName(FULLS.PARTICIPANTS);
    var columnaActiu = capcalera_(participants).indexOf('actiu') + 1;
    participants.getRange(2, columnaActiu, participants.getMaxRows() - 1, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());

    var activacions = llibre.getSheetByName(FULLS.ACTIVACIONS);
    var cap = capcalera_(activacions);
    activacions.getRange(2, cap.indexOf('escenari') + 1, activacions.getMaxRows() - 1, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInRange(llibre.getSheetByName(FULLS.ESCENARIS).getRange('A2:A'), true)
        .setAllowInvalid(false).setHelpText('Trieu un id de la pestanya Escenaris.').build());
  }

  /**
   * Afegeix els paràmetres que falten a Configuració (sense canviar els
   * valors existents), elimina els obsolets, actualitza les descripcions i
   * hi aplica les llistes desplegables.
   */
  function preparaParametres_(llibre, canvis) {
    var full = llibre.getSheetByName(FULLS.CONFIGURACIO);
    llegeixTaula_(FULLS.CONFIGURACIO).files.slice().reverse().forEach(function (f) {
      var clau = String(f.dades.clau).trim();
      if (PARAMETRES_OBSOLETS.indexOf(clau) === -1) return;
      full.deleteRow(f.fila);
      canvis.push('Paràmetre eliminat de Configuració: ' + clau + ' (ara és a cada fila de la pestanya Activacions)');
    });

    var existents = {};
    llegeixTaula_(FULLS.CONFIGURACIO).files.forEach(function (f) {
      existents[String(f.dades.clau).trim()] = true;
    });
    PARAMETRES.forEach(function (p) {
      if (existents[p.clau]) return;
      afegeix_(FULLS.CONFIGURACIO, { clau: p.clau, valor: p.valor, descripcio: p.descripcio });
      canvis.push('Paràmetre afegit a Configuració: ' + p.clau);
    });

    // Les descripcions són del programa: s'actualitzen amb cada versió.
    var descripcions = {};
    PARAMETRES.forEach(function (p) { descripcions[p.clau] = p.descripcio; });
    var actualitzades = 0;
    llegeixTaula_(FULLS.CONFIGURACIO).files.forEach(function (f) {
      var clau = String(f.dades.clau).trim();
      if (descripcions[clau] && f.dades.descripcio !== descripcions[clau]) {
        actualitza_(FULLS.CONFIGURACIO, 'clau', clau, { descripcio: descripcions[clau] });
        actualitzades++;
      }
    });
    if (actualitzades > 0) {
      canvis.push('Descripcions actualitzades a Configuració: ' + actualitzades);
    }

    llegeixTaula_(FULLS.CONFIGURACIO).files.forEach(function (f) {
      var cella = full.getRange(f.fila, 2);
      var clau = String(f.dades.clau).trim();
      var regla = null;
      if (clau === 'interval_minuts') {
        regla = SpreadsheetApp.newDataValidation()
          .requireValueInList(Config.LIMITS.INTERVALS_PERMESOS.map(String), true)
          .setAllowInvalid(false).setHelpText('Trieu 1, 5, 10, 15 o 30 minuts.').build();
      } else if (clau === 'correus_per_dia') {
        regla = SpreadsheetApp.newDataValidation()
          .requireValueInList(Config.LIMITS.CORREUS_PER_DIA_PERMESOS.map(String), true)
          .setAllowInvalid(false).setHelpText('100 amb un compte de Gmail; 1500 amb Google Workspace.').build();
      } else if (clau === 'max_torns_per_defecte') {
        var opcions = [];
        for (var n = 1; n <= Config.LIMITS.MAX_TORNS_ABSOLUT; n++) opcions.push(String(n));
        regla = SpreadsheetApp.newDataValidation()
          .requireValueInList(opcions, true)
          .setAllowInvalid(false).setHelpText('Trieu un nombre entre 1 i ' + Config.LIMITS.MAX_TORNS_ABSOLUT + '.').build();
      }
      if (regla) cella.setDataValidation(regla);
    });
  }

  function esCert_(valor) {
    return valor === true || String(valor).trim().toUpperCase() === 'TRUE';
  }

  /** Files de Participants: { fila, correu, actiu }. Sense la pestanya, cap. */
  function participants() {
    if (!llibre_().getSheetByName(FULLS.PARTICIPANTS)) return [];
    return llegeixTaula_(FULLS.PARTICIPANTS).files.map(function (f) {
      return { fila: f.fila, correu: Config.normalitzaCorreu(f.dades.correu), actiu: esCert_(f.dades.actiu) };
    }).filter(function (p) { return p.correu !== ''; });
  }

  /** Adreces vàlides marcades com a actives: les úniques que reben simulacions i respostes. */
  function participantsActius() {
    return participants().filter(function (p) { return p.actiu && Config.esCorreuValid(p.correu); })
      .map(function (p) { return p.correu; });
  }

  function esParticipantActiu(correu) {
    return participantsActius().indexOf(Config.normalitzaCorreu(correu)) !== -1;
  }

  function normalitzaActivacio_(f) {
    var d = f.dades;
    return {
      fila: f.fila,
      id_activacio: String(d.id_activacio || '').trim(),
      escenari: String(d.escenari || '').trim(),
      destinataris: Config.analitzaRemitents(d.destinataris),
      estat: String(d.estat || '').trim(),
      resultat: String(d.resultat || '')
    };
  }

  /** Files d'Activacions en ordre. */
  function activacions() {
    return llegeixTaula_(FULLS.ACTIVACIONS).files.map(normalitzaActivacio_);
  }

  /** Identificador per a una activació nova: ACT-001, ACT-002... */
  function seguentIdActivacio() {
    var maxim = 0;
    activacions().forEach(function (a) {
      var m = /^ACT-(\d+)$/.exec(a.id_activacio);
      if (m) maxim = Math.max(maxim, Number(m[1]));
    });
    return 'ACT-' + ('00' + (maxim + 1)).slice(-Math.max(3, String(maxim + 1).length));
  }

  function actualitzaActivacio(fila, canvis) {
    actualitzaFila_(FULLS.ACTIVACIONS, fila, canvis);
  }

  /**
   * Fila seleccionada d'una de les pestanyes acceptades. Retorna { numero }
   * o { error } amb el text que explica què cal fer (`com`).
   */
  function filaSeleccionada_(full, rang, pestanyes, com) {
    if (!full || !rang) return { error: 'No hi ha cap cel·la seleccionada.\n\n' + com };
    var nom = full.getName();
    if (pestanyes.indexOf(nom) === -1) {
      return { error: 'La cel·la seleccionada és a la pestanya «' + nom + '».\n\n' + com };
    }
    if (rang.getNumRows() !== 1) {
      return { error: 'Heu seleccionat ' + rang.getNumRows() + ' files. Seleccioneu-ne només una.\n\n' + com };
    }
    var numero = rang.getRow();
    if (numero < 2) return { error: 'Heu seleccionat la capçalera.\n\n' + com };
    return { numero: numero };
  }

  /**
   * Conversa de la fila seleccionada. Accepta una fila de Converses o de
   * Missatges (columna id_conversa). Retorna { conversa } o { error }.
   */
  function conversaDeLaSeleccio(full, rang) {
    var COM = 'Aneu a la pestanya Converses i feu clic a qualsevol cel·la de la fila de la conversa ' +
      '(no a la capçalera). Després torneu a triar l\'opció del menú.';
    var sel = filaSeleccionada_(full, rang, [FULLS.CONVERSES, FULLS.MISSATGES], COM);
    if (sel.error) return sel;
    var nom = full.getName();
    var columna = capcalera_(full).indexOf('id_conversa');
    if (columna === -1) return { error: 'La pestanya ' + nom + ' no té la columna id_conversa.' };
    var id = String(full.getRange(sel.numero, columna + 1).getValues()[0][0] || '').trim();
    if (!id) return { error: 'La fila ' + sel.numero + ' és buida.\n\n' + COM };
    var c = conversa(id);
    if (!c) return { error: 'No es troba la conversa ' + id + ' a la pestanya Converses.' };
    return { conversa: c };
  }

  /** Activació de la fila seleccionada. Retorna { activacio } o { error }. */
  function activacioDeLaSeleccio(full, rang) {
    var COM = 'Aneu a la pestanya Activacions i feu clic a qualsevol cel·la de la fila de l\'activació ' +
      '(no a la capçalera). Després torneu a triar l\'opció del menú.';
    var sel = filaSeleccionada_(full, rang, [FULLS.ACTIVACIONS], COM);
    if (sel.error) return sel;
    var trobada = null;
    activacions().forEach(function (a) { if (a.fila === sel.numero) trobada = a; });
    if (!trobada) return { error: 'La fila ' + sel.numero + ' és buida.\n\n' + COM };
    return { activacio: trobada };
  }

  /**
   * Correus de la clienta (inicials i respostes) registrats des de
   * `desDeIso`, enviats o en curs d'enviament. Serveix per no passar del
   * límit diari de Gmail.
   */
  function correusEnviatsDesDe(desDeIso) {
    return llegeixTaula_(FULLS.MISSATGES).files.filter(function (f) {
      var d = f.dades;
      return String(d.rol) === ROLS.INTERLOCUTOR &&
        (String(d.estat_enviament) === ESTATS_MISSATGE.ENVIAT || String(d.estat_enviament) === ESTATS_MISSATGE.PENDENT) &&
        String(d.data || '') >= desDeIso;
    }).length;
  }

  /**
   * Llegeix la pestanya Configuració. Retorna els valors normalitzats
   * (amb valors per defecte si una cel·la és buida o incorrecta) i la
   * llista de problemes trobats.
   */
  function configuracio() {
    var errors = [];
    var crus = {};
    var llibre = llibre_();
    if (!llibre.getSheetByName(FULLS.CONFIGURACIO)) {
      errors.push({ clau: 'Configuració', missatge: 'la pestanya no existeix: feu Rèplica › Configuració › Prepara el full (o executeu preparaFulls)' });
    } else {
      llegeixTaula_(FULLS.CONFIGURACIO).files.forEach(function (f) {
        crus[String(f.dades.clau).trim()] = f.dades.valor;
      });
    }
    function text(clau) { return String(crus[clau] === undefined || crus[clau] === null ? '' : crus[clau]).trim(); }

    var interval = Number(text('interval_minuts'));
    if (text('interval_minuts') === '') {
      interval = Config.LIMITS.INTERVAL_DISPARADOR_MINUTS;
    } else if (Config.LIMITS.INTERVALS_PERMESOS.indexOf(interval) === -1) {
      errors.push({ clau: 'interval_minuts', missatge: '"' + text('interval_minuts') + '" no és vàlid; ha de ser 1, 5, 10, 15 o 30' });
      interval = Config.LIMITS.INTERVAL_DISPARADOR_MINUTS;
    }

    var correusPerDia = Number(text('correus_per_dia'));
    if (text('correus_per_dia') === '') {
      correusPerDia = Config.LIMITS.CORREUS_PER_DIA_PER_DEFECTE;
    } else if (Config.LIMITS.CORREUS_PER_DIA_PERMESOS.indexOf(correusPerDia) === -1) {
      errors.push({ clau: 'correus_per_dia', missatge: '"' + text('correus_per_dia') + '" no és vàlid; ha de ser 100 o 1500' });
      correusPerDia = Config.LIMITS.CORREUS_PER_DIA_PER_DEFECTE;
    }

    var maxTorns = Number(text('max_torns_per_defecte'));
    if (text('max_torns_per_defecte') === '') {
      maxTorns = Config.LIMITS.MAX_TORNS_PER_DEFECTE;
    } else if (!(maxTorns >= 1 && maxTorns <= Config.LIMITS.MAX_TORNS_ABSOLUT && Math.floor(maxTorns) === maxTorns)) {
      errors.push({ clau: 'max_torns_per_defecte', missatge: 'ha de ser un nombre enter entre 1 i ' + Config.LIMITS.MAX_TORNS_ABSOLUT });
      maxTorns = Config.LIMITS.MAX_TORNS_PER_DEFECTE;
    }

    return {
      valors: {
        intervalMinuts: interval,
        maxTornsPerDefecte: maxTorns,
        correusPerDia: correusPerDia
      },
      errors: errors
    };
  }

  /** Canvia el valor d'un paràmetre de Configuració. */
  function estableixConfiguracio(clau, valor) {
    actualitza_(FULLS.CONFIGURACIO, 'clau', clau, { valor: valor });
  }

  /**
   * Elimina la pestanya que Google crea amb cada full nou ("Sheet1",
   * "Full 1", "Hoja 1"...), només si és completament buida.
   */
  function eliminaFullsBuitsPerDefecte_(llibre) {
    var PATRO_NOM_PER_DEFECTE = /^(Sheet|Full|Hoja|Feuille|Foglio|Tabelle|Blad|Folha)\s?\d+$/i;
    var eliminades = [];
    llibre.getSheets().forEach(function (full) {
      var nom = full.getName();
      if (COLUMNES[nom] || !PATRO_NOM_PER_DEFECTE.test(nom)) return;
      if (full.getLastRow() !== 0 || full.getLastColumn() !== 0) return;
      llibre.deleteSheet(full);
      eliminades.push(nom);
    });
    return eliminades;
  }

  /** Llegeix una pestanya com a llista d'objectes amb el número de fila. */
  function llegeixTaula_(nom) {
    var full = full_(nom);
    var valors = full.getDataRange().getValues();
    if (valors.length === 0) return { full: full, capcalera: [], files: [] };
    var capcalera = valors[0].map(function (v) { return String(v).trim(); });
    var files = [];
    for (var i = 1; i < valors.length; i++) {
      var dades = {};
      var buida = true;
      for (var j = 0; j < capcalera.length; j++) {
        if (!capcalera[j]) continue;
        dades[capcalera[j]] = valors[i][j];
        if (valors[i][j] !== '' && valors[i][j] !== null) buida = false;
      }
      if (!buida) files.push({ fila: i + 1, dades: dades });
    }
    return { full: full, capcalera: capcalera, files: files };
  }

  function afegeix_(nom, objecte) {
    var full = full_(nom);
    var capcalera = capcalera_(full);
    var fila = capcalera.map(function (c) {
      var v = objecte[c];
      return valorSegur_(v === undefined || v === null ? '' : v);
    });
    var numeroFila = full.getLastRow() + 1;
    if (numeroFila > full.getMaxRows()) {
      full.insertRowsAfter(full.getMaxRows(), 100);
    }
    var rang = full.getRange(numeroFila, 1, 1, fila.length);
    // Format de text abans d'escriure: les dates ISO i els identificadors
    // de Gmail no s'han de convertir en dates ni en números.
    if (FULLS_TEXT.indexOf(nom) !== -1) rang.setNumberFormat('@');
    rang.setValues([fila]);
  }

  function actualitza_(nom, columnaId, id, canvis) {
    var taula = llegeixTaula_(nom);
    var trobada = null;
    taula.files.forEach(function (f) {
      if (String(f.dades[columnaId]) === String(id)) trobada = f;
    });
    if (!trobada) throw new Error('No s\'ha trobat ' + columnaId + '=' + id + ' a ' + nom + '.');
    escriuFila_(taula, trobada, canvis);
  }

  /** Canvia columnes d'una fila concreta (pel número de fila). */
  function actualitzaFila_(nom, numero, canvis) {
    var taula = llegeixTaula_(nom);
    var trobada = null;
    taula.files.forEach(function (f) { if (f.fila === numero) trobada = f; });
    if (!trobada) throw new Error('La fila ' + numero + ' de ' + nom + ' és buida.');
    escriuFila_(taula, trobada, canvis);
  }

  function escriuFila_(taula, trobada, canvis) {
    var fila = taula.capcalera.map(function (c) {
      var v = Object.prototype.hasOwnProperty.call(canvis, c) ? canvis[c] : trobada.dades[c];
      return valorSegur_(v === undefined || v === null ? '' : v);
    });
    taula.full.getRange(trobada.fila, 1, 1, fila.length).setValues([fila]);
  }

  function normalitzaEscenari_(d) {
    var e = {};
    COLUMNES.Escenaris.forEach(function (c) { e[c] = d[c]; });
    e.id = String(d.id).trim();
    e.actiu = d.actiu === true || String(d.actiu).trim().toUpperCase() === 'TRUE';
    e.max_torns = Number(d.max_torns) || configuracio().valors.maxTornsPerDefecte;
    e.max_torns = Math.min(Math.max(1, Math.floor(e.max_torns)), Config.LIMITS.MAX_TORNS_ABSOLUT);
    COLUMNES.Escenaris.forEach(function (c) {
      if (typeof e[c] === 'string') e[c] = e[c].trim();
    });
    return e;
  }

  function escenari(id) {
    var trobat = null;
    llegeixTaula_(FULLS.ESCENARIS).files.forEach(function (f) {
      if (String(f.dades.id).trim() === String(id).trim()) trobat = normalitzaEscenari_(f.dades);
    });
    return trobat;
  }

  function normalitzaConversa_(d) {
    return {
      id_conversa: String(d.id_conversa),
      id_escenari: String(d.id_escenari),
      correu_participant: Config.normalitzaCorreu(d.correu_participant),
      gmail_thread_id: String(d.gmail_thread_id || ''),
      estat: String(d.estat || ''),
      torns_ia: Number(d.torns_ia) || 0,
      data_inici: String(d.data_inici || ''),
      data_actualitzacio: String(d.data_actualitzacio || ''),
      darrer_error: String(d.darrer_error || ''),
      id_activacio: String(d.id_activacio || ''),
      max_torns_conversa: Number(d.max_torns_conversa) || 0
    };
  }

  /** Converses, opcionalment filtrades per estat (llista d'estats). */
  function converses(estats) {
    return llegeixTaula_(FULLS.CONVERSES).files
      .map(function (f) { return normalitzaConversa_(f.dades); })
      .filter(function (c) { return !estats || estats.indexOf(c.estat) !== -1; });
  }

  function conversa(idConversa) {
    var llista = converses().filter(function (c) { return c.id_conversa === String(idConversa); });
    return llista.length ? llista[0] : null;
  }

  function afegeixConversa(c) {
    afegeix_(FULLS.CONVERSES, c);
  }

  function actualitzaConversa(idConversa, canvis) {
    var c = Object.assign({}, canvis, { data_actualitzacio: new Date().toISOString() });
    actualitza_(FULLS.CONVERSES, 'id_conversa', idConversa, c);
  }

  function normalitzaMissatge_(d) {
    return {
      id_missatge: String(d.id_missatge),
      id_conversa: String(d.id_conversa),
      gmail_message_id: String(d.gmail_message_id || ''),
      rol: String(d.rol),
      data: String(d.data || ''),
      contingut: String(d.contingut || ''),
      estat_enviament: String(d.estat_enviament || ''),
      respon_a: String(d.respon_a || '').split(',').map(function (s) { return s.trim(); })
        .filter(function (s) { return s; }),
      tanca_conversa: d.tanca_conversa === true || String(d.tanca_conversa).toUpperCase() === 'TRUE'
    };
  }

  /** Missatges d'una conversa en ordre d'inserció (cronològic). */
  function missatges(idConversa) {
    return llegeixTaula_(FULLS.MISSATGES).files
      .map(function (f) { return normalitzaMissatge_(f.dades); })
      .filter(function (m) { return m.id_conversa === String(idConversa); });
  }

  function afegeixMissatge(m) {
    var copia = Object.assign({}, m);
    if (Array.isArray(copia.respon_a)) copia.respon_a = copia.respon_a.join(',');
    if (typeof copia.tanca_conversa === 'boolean') copia.tanca_conversa = copia.tanca_conversa ? 'TRUE' : 'FALSE';
    afegeix_(FULLS.MISSATGES, copia);
  }

  function actualitzaMissatge(idMissatge, canvis) {
    actualitza_(FULLS.MISSATGES, 'id_missatge', idMissatge, canvis);
  }

  /** Força l'escriptura abans d'una acció externa (enviar un correu). */
  function confirma() {
    SpreadsheetApp.flush();
  }

  /** Columnes d'una pestanya que encara no existeixen (cal Prepara el full). */
  function columnesQueFalten(nom) {
    var actual = capcalera_(full_(nom));
    return COLUMNES[nom].filter(function (c) { return actual.indexOf(c) === -1; });
  }

  /** Diagnòstic per a comprovaConfiguracio(). */
  function diagnostica() {
    var llibre = llibre_();
    return Object.keys(COLUMNES).map(function (nom) {
      var full = llibre.getSheetByName(nom);
      if (!full) return { pestanya: nom, existeix: false, columnesQueFalten: COLUMNES[nom] };
      var actual = capcalera_(full);
      return {
        pestanya: nom,
        existeix: true,
        columnesQueFalten: COLUMNES[nom].filter(function (c) { return actual.indexOf(c) === -1; })
      };
    });
  }

  return {
    FULLS: FULLS,
    COLUMNES: COLUMNES,
    ESTATS_CONVERSA: ESTATS_CONVERSA,
    ESTATS_MISSATGE: ESTATS_MISSATGE,
    ESTATS_ACTIVACIO: ESTATS_ACTIVACIO,
    ROLS: ROLS,
    llibre: llibre_,
    origen: origen,
    preparaFulls: preparaFulls,
    configuracio: configuracio,
    participants: participants,
    participantsActius: participantsActius,
    esParticipantActiu: esParticipantActiu,
    activacions: activacions,
    seguentIdActivacio: seguentIdActivacio,
    actualitzaActivacio: actualitzaActivacio,
    conversaDeLaSeleccio: conversaDeLaSeleccio,
    activacioDeLaSeleccio: activacioDeLaSeleccio,
    correusEnviatsDesDe: correusEnviatsDesDe,
    estableixConfiguracio: estableixConfiguracio,
    escenari: escenari,
    converses: converses,
    conversa: conversa,
    afegeixConversa: afegeixConversa,
    actualitzaConversa: actualitzaConversa,
    missatges: missatges,
    afegeixMissatge: afegeixMissatge,
    actualitzaMissatge: actualitzaMissatge,
    confirma: confirma,
    columnesQueFalten: columnesQueFalten,
    diagnostica: diagnostica
  };
})();
