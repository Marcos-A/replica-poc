/**
 * Accés a Google Sheets: quatre pestanyes amb capçalera a la fila 1.
 *
 * Configuració conté els paràmetres operatius que el docent pot canviar
 * sense tocar codi. Els secrets i els controls de seguretat (clau, model,
 * remitents autoritzats, interruptor) continuen a Script Properties.
 *
 * Les pestanyes Converses i Missatges tenen format de text pla (@) perquè
 * Sheets no converteixi dates ISO ni identificadors de Gmail en números.
 */
var Repositori = (function () {
  var FULLS = {
    CONFIGURACIO: 'Configuració',
    ESCENARIS: 'Escenaris',
    CONVERSES: 'Converses',
    MISSATGES: 'Missatges'
  };

  var COLUMNES = {
    'Configuració': ['clau', 'valor', 'descripcio'],
    Escenaris: [
      'id', 'actiu', 'titol', 'interlocutor', 'empresa', 'caracter', 'incidencia',
      'objectiu_interlocutor', 'limits_reservats', 'objectiu_participant', 'criteris',
      'idioma', 'assumpte_inicial', 'missatge_inicial', 'max_torns'
    ],
    Converses: [
      'id_conversa', 'id_escenari', 'correu_participant', 'gmail_thread_id', 'estat',
      'torns_ia', 'data_inici', 'data_actualitzacio', 'darrer_error'
    ],
    // respon_a i tanca_conversa amplien l'especificació: permeten saber quins
    // missatges del participant ja tenen resposta i reconciliar un enviament
    // interromput sense tornar a cridar la IA.
    Missatges: [
      'id_missatge', 'id_conversa', 'gmail_message_id', 'rol', 'data', 'contingut',
      'estat_enviament', 'respon_a', 'tanca_conversa'
    ]
  };

  var FULLS_TEXT = [FULLS.CONVERSES, FULLS.MISSATGES];

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
      clau: 'escenari',
      valor: 'ESC-001',
      descripcio: 'Escenari (columna id de la pestanya Escenaris) que s\'utilitza en executar provaIniciaSimulacio.'
    },
    {
      clau: 'participant',
      valor: '',
      descripcio: 'UNA SOLA adreça: el docent amb qui iniciareu la propera simulació en executar ' +
        'provaIniciaSimulacio. Ha de ser també a ALLOWED_SENDERS (Propietats de l\'script).'
    },
    {
      clau: 'max_torns_per_defecte',
      valor: 6,
      descripcio: 'Nombre màxim de respostes de la IA per conversa (de 1 a 12) quan l\'escenari no ' +
        'n\'indica cap a la columna max_torns.'
    }
  ];

  var llibreEnMemoria_ = null;

  function llibre_() {
    if (llibreEnMemoria_) return llibreEnMemoria_;
    var id = Config.llegeix().spreadsheetId;
    if (!id) throw new Error('Falta la propietat SPREADSHEET_ID a Script Properties.');
    llibreEnMemoria_ = SpreadsheetApp.openById(id);
    return llibreEnMemoria_;
  }

  function full_(nom) {
    var full = llibre_().getSheetByName(nom);
    if (!full) {
      throw new Error('No existeix la pestanya "' + nom + '". Executa preparaFulls().');
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
    Object.keys(COLUMNES).forEach(function (nom) {
      var full = llibre.getSheetByName(nom);
      if (!full) {
        full = llibre.insertSheet(nom);
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
    eliminaFullsBuitsPerDefecte_(llibre).forEach(function (nom) {
      canvis.push('Pestanya buida eliminada: ' + nom);
    });
    SpreadsheetApp.flush();
    return canvis;
  }

  /**
   * Afegeix els paràmetres que falten a Configuració (sense canviar els
   * valors existents) i hi aplica les llistes desplegables.
   */
  function preparaParametres_(llibre, canvis) {
    var existents = {};
    llegeixTaula_(FULLS.CONFIGURACIO).files.forEach(function (f) {
      existents[String(f.dades.clau).trim()] = true;
    });
    // Migració: les propietats antigues PROVA_* passen a la pestanya.
    var antigues = {
      participant: Config.propietat(Config.PROPIETATS.PROVA_PARTICIPANT),
      escenari: Config.propietat(Config.PROPIETATS.PROVA_ESCENARI)
    };
    PARAMETRES.forEach(function (p) {
      if (existents[p.clau]) return;
      var valor = antigues[p.clau] || p.valor;
      afegeix_(FULLS.CONFIGURACIO, { clau: p.clau, valor: valor, descripcio: p.descripcio });
      canvis.push('Paràmetre afegit a Configuració: ' + p.clau +
        (antigues[p.clau] ? ' (copiat de la propietat ' + (p.clau === 'participant' ? 'PROVA_PARTICIPANT' : 'PROVA_ESCENARI') + ')' : ''));
    });

    var full = llibre.getSheetByName(FULLS.CONFIGURACIO);
    var escenaris = llibre.getSheetByName(FULLS.ESCENARIS);
    llegeixTaula_(FULLS.CONFIGURACIO).files.forEach(function (f) {
      var cella = full.getRange(f.fila, 2);
      var clau = String(f.dades.clau).trim();
      var regla = null;
      if (clau === 'interval_minuts') {
        regla = SpreadsheetApp.newDataValidation()
          .requireValueInList(Config.LIMITS.INTERVALS_PERMESOS.map(String), true)
          .setAllowInvalid(false).setHelpText('Trieu 1, 5, 10, 15 o 30 minuts.').build();
      } else if (clau === 'escenari') {
        regla = SpreadsheetApp.newDataValidation()
          .requireValueInRange(escenaris.getRange('A2:A'), true)
          .setAllowInvalid(false).setHelpText('Trieu un id de la pestanya Escenaris.').build();
      } else if (clau === 'max_torns_per_defecte') {
        regla = SpreadsheetApp.newDataValidation()
          .requireNumberBetween(1, Config.LIMITS.MAX_TORNS_ABSOLUT)
          .setAllowInvalid(false).setHelpText('Un nombre entre 1 i ' + Config.LIMITS.MAX_TORNS_ABSOLUT + '.').build();
      }
      if (regla) cella.setDataValidation(regla);
    });
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
      errors.push({ clau: 'Configuració', missatge: 'la pestanya no existeix: executa preparaFulls()' });
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
        escenari: text('escenari') || 'ESC-001',
        participants: Config.analitzaRemitents(text('participant')),
        maxTornsPerDefecte: maxTorns
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
      darrer_error: String(d.darrer_error || '')
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
    ROLS: ROLS,
    preparaFulls: preparaFulls,
    configuracio: configuracio,
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
    diagnostica: diagnostica
  };
})();
