/**
 * Lògica de conversa: inici, processament periòdic, reconciliació i tancament.
 *
 * Garanties i límits:
 * - Com a màxim una resposta automàtica per intervenció pendent (els
 *   missatges seguits del participant s'agrupen).
 * - Abans d'enviar es desa un registre PENDENT amb el text i els missatges
 *   que respon. Si l'execució s'interromp, la següent el reconcilia amb el
 *   fil de Gmail en lloc de tornar a enviar.
 * - No es pot garantir "exactament una vegada": si no es pot demostrar que
 *   un enviament s'ha fet, la conversa passa a ERROR i cal revisió humana.
 *   Es prioritza no duplicar respostes.
 */
var Simulacio = (function () {
  // Temps mínim abans de buscar a "Enviats" un missatge inicial interromput
  // (l'índex de cerca de Gmail pot trigar uns segons a actualitzar-se).
  var ESPERA_RECONCILIACIO_INICIAL_MS = 2 * 60 * 1000;

  function E_() { return Repositori.ESTATS_CONVERSA; }
  function M_() { return Repositori.ESTATS_MISSATGE; }
  function R_() { return Repositori.ROLS; }

  function ara_() { return new Date().toISOString(); }

  /** Nom visible del remitent: "Marta Soler, responsable..." → "Marta Soler". */
  function nomVisible_(escenari) {
    return String(escenari.interlocutor || '').split(',')[0].trim();
  }

  function ambBloqueig_(funcio) {
    var bloqueig = LockService.getScriptLock();
    if (!bloqueig.tryLock(Config.LIMITS.ESPERA_BLOQUEIG_MS)) return { bloquejat: true };
    try {
      return { resultat: funcio() };
    } finally {
      bloqueig.releaseLock();
    }
  }

  // ---------------------------------------------------------------- Inici

  /**
   * Correus de la clienta enviats en les darreres 24 hores i quants en
   * queden fins al límit de la pestanya Configuració (correus_per_dia).
   */
  function correusDisponibles() {
    var limit = Repositori.configuracio().valors.correusPerDia;
    var desDe = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    var enviats = Repositori.correusEnviatsDesDe(desDe);
    return { limit: limit, enviats: enviats, restants: Math.max(0, limit - enviats) };
  }

  function inicia(correuParticipant, idEscenari, idActivacio) {
    var adreca = Config.normalitzaCorreu(correuParticipant);
    if (!Config.llegeix().simulacioActivada) {
      throw new Error('La simulació està desactivada (SIMULATION_ENABLED=false). Activeu-la amb Rèplica › Activa les simulacions (o executeu activaSimulacions) quan el coordinador ho confirmi.');
    }
    if (!Config.esCorreuValid(adreca)) {
      throw new Error('L\'adreça del participant no és vàlida.');
    }
    if (!Repositori.esParticipantActiu(adreca)) {
      throw new Error('L\'adreça ' + Registre.emmascaraCorreu(adreca) + ' no és a la pestanya Participants ' +
        '(o no hi està marcada com a activa).');
    }
    if (Bustia.adrecesPropies().indexOf(adreca) !== -1) {
      throw new Error('El participant no pot ser la mateixa bústia de prova.');
    }
    var escenari = Repositori.escenari(idEscenari);
    if (!escenari) throw new Error('No existeix l\'escenari ' + idEscenari + '.');
    if (!escenari.actiu) throw new Error('L\'escenari ' + escenari.id + ' no està actiu.');
    if (!escenari.assumpte_inicial || !escenari.missatge_inicial) {
      throw new Error('L\'escenari ' + escenari.id + ' no té assumpte o missatge inicial.');
    }
    var correus = correusDisponibles();
    if (correus.restants <= 0) {
      throw new Error('S\'ha arribat al límit de ' + correus.limit + ' correus en 24 hores (correus_per_dia, pestanya ' +
        'Configuració). Torneu-ho a provar més tard.');
    }

    var execucio = ambBloqueig_(function () {
      var oberta = Repositori.converses([E_().ACTIVA, E_().PROCESSANT, E_().ERROR]).filter(function (c) {
        return c.correu_participant === adreca && c.id_escenari === escenari.id;
      });
      if (oberta.length > 0) {
        throw new Error('Ja hi ha una conversa oberta (' + oberta[0].id_conversa + ', ' + oberta[0].estat +
          ') d\'aquest escenari per a aquest participant. Atureu-la (Rèplica › Atura la conversa seleccionada, o tancaConversa) si cal tornar a començar.');
      }
      var idConversa = Utilities.getUuid();
      var idMissatge = Utilities.getUuid();
      var ara = ara_();
      // 1. Registre de sortida abans d'enviar.
      Repositori.afegeixConversa({
        id_conversa: idConversa,
        id_escenari: escenari.id,
        correu_participant: adreca,
        gmail_thread_id: '',
        estat: E_().PROCESSANT,
        torns_ia: 0,
        data_inici: ara,
        data_actualitzacio: ara,
        darrer_error: '',
        id_activacio: idActivacio || ''
      });
      Repositori.afegeixMissatge({
        id_missatge: idMissatge,
        id_conversa: idConversa,
        gmail_message_id: '',
        rol: R_().INTERLOCUTOR,
        data: ara,
        contingut: escenari.missatge_inicial,
        estat_enviament: M_().PENDENT,
        respon_a: [],
        tanca_conversa: false
      });
      Repositori.confirma();

      // 2. Enviament.
      var enviat;
      try {
        enviat = Bustia.enviaInicial(adreca, escenari.assumpte_inicial, escenari.missatge_inicial, nomVisible_(escenari));
      } catch (e) {
        Repositori.actualitzaConversa(idConversa, { darrer_error: 'Enviament inicial no confirmat: ' + Registre.resumError(e) });
        throw new Error('No s\'ha pogut confirmar l\'enviament inicial (' + Registre.resumError(e) +
          '). La conversa queda en PROCESSANT i el processador la reconciliarà amb la carpeta Enviats.');
      }

      // 3. Confirmació.
      Repositori.actualitzaMissatge(idMissatge, { gmail_message_id: enviat.messageId, estat_enviament: M_().ENVIAT });
      Repositori.actualitzaConversa(idConversa, { gmail_thread_id: enviat.threadId, estat: E_().ACTIVA, darrer_error: '' });
      Repositori.confirma();
      Registre.info('Simulació iniciada', { idConversa: idConversa, escenari: escenari.id, participant: adreca });
      return { idConversa: idConversa, threadId: enviat.threadId, messageId: enviat.messageId };
    });
    if (execucio.bloquejat) {
      throw new Error('Hi ha una altra execució en curs. Torna-ho a provar d\'aquí a un minut.');
    }
    return execucio.resultat;
  }

  // -------------------------------------------------------- Processament

  function processaPendents() {
    if (!Config.llegeix().simulacioActivada) {
      Registre.info('Processament omès: SIMULATION_ENABLED=false');
      return { estat: 'DESACTIVADA' };
    }
    var bloqueig = LockService.getScriptLock();
    if (!bloqueig.tryLock(Config.LIMITS.ESPERA_BLOQUEIG_MS)) {
      Registre.info('Processament omès: una altra execució té el bloqueig');
      return { estat: 'BLOQUEJAT' };
    }
    var inici = Date.now();
    var resum = { estat: 'OK', revisades: 0, respostes: 0, errors: 0, ajornades: 0, limitDiari: 0 };
    try {
      try {
        Disparador.sincronitza();
      } catch (e) {
        Registre.avis('No s\'ha pogut actualitzar l\'interval del disparador', { error: Registre.resumError(e) });
      }
      // Es llegeixen totes les converses, primer les que fa més temps que no
      // canvien: així cap conversa queda sempre al final de la cua. El límit
      // per execució s'aplica a les respostes de la IA, no a les lectures.
      var converses = Repositori.converses([E_().ACTIVA, E_().PROCESSANT]).sort(function (a, b) {
        return a.data_actualitzacio < b.data_actualitzacio ? -1 : a.data_actualitzacio > b.data_actualitzacio ? 1 : 0;
      });
      if (converses.length === 0) return resum;
      var ctx = {
        propies: Bustia.adrecesPropies(),
        actius: Repositori.participantsActius(),
        restants: correusDisponibles().restants,
        generades: 0
      };
      for (var i = 0; i < converses.length; i++) {
        if (Date.now() - inici > Config.LIMITS.TEMPS_MAX_EXECUCIO_MS) {
          resum.ajornades += converses.length - i;
          break;
        }
        resum.revisades++;
        var c = converses[i];
        try {
          var resultat = processaConversa_(c, ctx);
          if (resultat === 'RESPOSTA') resum.respostes++;
          if (resultat === 'ERROR') resum.errors++;
          if (resultat === 'AJORNADA') resum.ajornades++;
          if (resultat === 'LIMIT_DIARI') resum.limitDiari++;
        } catch (e) {
          resum.errors++;
          Registre.error('Error inesperat processant una conversa', { idConversa: c.id_conversa, error: Registre.resumError(e) });
          try {
            Repositori.actualitzaConversa(c.id_conversa, { darrer_error: Registre.resumError(e) });
          } catch (e2) { /* ja registrat */ }
        }
      }
      Registre.info('Processament acabat', resum);
      return resum;
    } finally {
      bloqueig.releaseLock();
    }
  }

  /** Missatges del participant que encara no tenen cap resposta vàlida. */
  function pendentsDeResposta(registrats) {
    var resposts = {};
    registrats.forEach(function (m) {
      if (m.rol === R_().INTERLOCUTOR && m.estat_enviament !== M_().ERROR) {
        m.respon_a.forEach(function (id) { resposts[id] = true; });
      }
    });
    return registrats.filter(function (m) {
      return m.rol === R_().PARTICIPANT && m.estat_enviament === M_().REBUT && !resposts[m.id_missatge];
    });
  }

  /**
   * ctx: { propies, actius, restants (correus que es poden enviar),
   * generades (respostes de la IA en aquesta execució) }.
   */
  function processaConversa_(conversa, ctx) {
    var c = conversa;
    var propies = ctx.propies;
    if (c.estat === E_().PROCESSANT) {
      if (!reconcilia_(c, propies)) return 'RECONCILIADA';
      c = Repositori.conversa(c.id_conversa);
      if (c.estat !== E_().ACTIVA) return 'RECONCILIADA';
    }
    if (!c.gmail_thread_id) {
      Repositori.actualitzaConversa(c.id_conversa, { estat: E_().ERROR, darrer_error: 'La conversa no té fil de Gmail.' });
      return 'ERROR';
    }
    var escenari = Repositori.escenari(c.id_escenari);
    if (!escenari) {
      Repositori.actualitzaConversa(c.id_conversa, { estat: E_().ERROR, darrer_error: 'No existeix l\'escenari ' + c.id_escenari + '.' });
      return 'ERROR';
    }

    // 1. Registrar els missatges nous vàlids del participant.
    var registrats = Repositori.missatges(c.id_conversa);
    var nous = registraEntrants_(c, registrats, ctx);
    if (nous > 0) registrats = Repositori.missatges(c.id_conversa);

    // 2. Hi ha alguna intervenció pendent?
    var pendents = pendentsDeResposta(registrats);
    if (pendents.length === 0) return 'SENSE_CANVIS';
    if (c.torns_ia >= escenari.max_torns) {
      Repositori.actualitzaConversa(c.id_conversa, { estat: E_().FINALITZADA });
      return 'FINALITZADA';
    }
    // Límits: queda pendent (sense canviar res) per a la propera execució.
    if (ctx.generades >= Config.LIMITS.MAX_RESPOSTES_PER_EXECUCIO) return 'AJORNADA';
    if (ctx.restants <= 0) {
      Registre.avis('Límit diari de correus: la resposta espera a la propera revisió', { idConversa: c.id_conversa });
      return 'LIMIT_DIARI';
    }
    ctx.generades++;
    var darrerTorn = c.torns_ia + 1 >= escenari.max_torns;
    var historial = registrats.filter(function (m) {
      if (pendents.indexOf(m) !== -1) return false;
      if (m.rol === R_().INTERLOCUTOR) return m.estat_enviament === M_().ENVIAT;
      return m.estat_enviament === M_().REBUT;
    });

    Repositori.actualitzaConversa(c.id_conversa, { estat: E_().PROCESSANT });
    Repositori.confirma();

    // 3. Generar la resposta. Si falla, no s'envia res.
    var resposta;
    try {
      resposta = ProveidorIA.genera({
        escenari: escenari,
        historial: historial,
        missatgesNous: pendents,
        configuracio: { darrerTorn: darrerTorn, torn: c.torns_ia + 1, maxTorns: escenari.max_torns }
      });
    } catch (e) {
      var estat = e.reintentable ? E_().ACTIVA : E_().ERROR;
      Repositori.actualitzaConversa(c.id_conversa, { estat: estat, darrer_error: Registre.resumError(e) });
      Registre.error('Error de la IA; no s\'envia cap resposta', {
        idConversa: c.id_conversa, reintentable: !!e.reintentable, error: Registre.resumError(e)
      });
      return 'ERROR';
    }
    // Regla del motor: el darrer torn sempre tanca la conversa.
    var tanca = resposta.finalitzada || darrerTorn;

    // 4. Registre de sortida abans d'enviar.
    var idMissatge = Utilities.getUuid();
    Repositori.afegeixMissatge({
      id_missatge: idMissatge,
      id_conversa: c.id_conversa,
      gmail_message_id: '',
      rol: R_().INTERLOCUTOR,
      data: ara_(),
      contingut: resposta.text,
      estat_enviament: M_().PENDENT,
      respon_a: pendents.map(function (m) { return m.id_missatge; }),
      tanca_conversa: tanca
    });
    Repositori.confirma();

    // 5. Enviament al mateix fil, responent al darrer missatge pendent.
    var enviat;
    try {
      enviat = Bustia.respon(c.gmail_thread_id, pendents[pendents.length - 1].gmail_message_id, resposta.text, nomVisible_(escenari));
    } catch (e) {
      // Estat incert: la conversa queda en PROCESSANT i es reconciliarà.
      Repositori.actualitzaConversa(c.id_conversa, { darrer_error: 'Enviament no confirmat: ' + Registre.resumError(e) });
      Registre.error('Enviament no confirmat; es reconciliarà a la propera execució', { idConversa: c.id_conversa });
      return 'ERROR';
    }
    ctx.restants--;
    completaEnviament_(c.id_conversa, idMissatge, enviat.messageId, tanca);
    Registre.info('Resposta enviada', {
      idConversa: c.id_conversa, torn: c.torns_ia + 1, finalitzada: tanca, model: resposta.model
    });
    return 'RESPOSTA';
  }

  /** Registra els missatges entrants vàlids; retorna quants n'ha afegit. */
  function registraEntrants_(c, registrats, ctx) {
    var coneguts = {};
    registrats.forEach(function (m) {
      if (m.gmail_message_id) coneguts[m.gmail_message_id] = true;
    });
    var autoritzat = ctx.actius.indexOf(c.correu_participant) !== -1;
    var afegits = 0;
    Bustia.llegeixFil(c.gmail_thread_id, coneguts, ctx.propies).forEach(function (d) {
      if (d.conegut) return;
      if (d.propi) {
        Registre.avis('Missatge de la pròpia bústia no registrat; s\'ignora', { idConversa: c.id_conversa, gmailId: d.id });
        return;
      }
      if (d.adreca !== c.correu_participant || !autoritzat) {
        Registre.info('Missatge d\'un remitent no autoritzat; s\'ignora', { idConversa: c.id_conversa, remitent: d.adreca });
        return;
      }
      if (d.automatic) {
        Registre.info('Missatge automàtic; s\'ignora', { idConversa: c.id_conversa, gmailId: d.id });
        return;
      }
      if (!d.cos) {
        Registre.info('Missatge sense text útil; s\'ignora', { idConversa: c.id_conversa, gmailId: d.id });
        return;
      }
      Repositori.afegeixMissatge({
        id_missatge: Utilities.getUuid(),
        id_conversa: c.id_conversa,
        gmail_message_id: d.id,
        rol: R_().PARTICIPANT,
        data: d.data.toISOString(),
        contingut: d.cos,
        estat_enviament: M_().REBUT,
        respon_a: [],
        tanca_conversa: false
      });
      afegits++;
    });
    return afegits;
  }

  function completaEnviament_(idConversa, idMissatge, gmailMessageId, tanca) {
    var c = Repositori.conversa(idConversa);
    Repositori.actualitzaMissatge(idMissatge, { gmail_message_id: gmailMessageId, estat_enviament: M_().ENVIAT });
    Repositori.actualitzaConversa(idConversa, {
      torns_ia: c.torns_ia + 1,
      estat: tanca ? E_().FINALITZADA : E_().ACTIVA,
      darrer_error: ''
    });
    Repositori.confirma();
  }

  // ------------------------------------------------------- Reconciliació

  /**
   * Resol una conversa que ha quedat en PROCESSANT per una interrupció.
   * Retorna true si la conversa torna a ACTIVA i es pot continuar processant.
   */
  function reconcilia_(c, propies) {
    var registrats = Repositori.missatges(c.id_conversa);
    var pendents = registrats.filter(function (m) {
      return m.rol === R_().INTERLOCUTOR && m.estat_enviament === M_().PENDENT;
    });
    if (pendents.length === 0) {
      // Interrompuda abans de desar cap sortida: es pot tornar a processar.
      Repositori.actualitzaConversa(c.id_conversa, { estat: E_().ACTIVA });
      return true;
    }
    var p = pendents[pendents.length - 1];
    pendents.slice(0, -1).forEach(function (m) {
      Repositori.actualitzaMissatge(m.id_missatge, { estat_enviament: M_().ERROR });
    });

    if (!c.gmail_thread_id) {
      // Missatge inicial: cal cercar-lo a Enviats.
      if (Date.now() - Date.parse(c.data_actualitzacio) < ESPERA_RECONCILIACIO_INICIAL_MS) return false;
      var escenari = Repositori.escenari(c.id_escenari);
      var trobat = escenari ? Bustia.cercaEnviat(c.correu_participant, escenari.assumpte_inicial, p.data) : null;
      if (trobat) {
        Repositori.actualitzaMissatge(p.id_missatge, { gmail_message_id: trobat.messageId, estat_enviament: M_().ENVIAT });
        Repositori.actualitzaConversa(c.id_conversa, { gmail_thread_id: trobat.threadId, estat: E_().ACTIVA, darrer_error: '' });
        Registre.info('Enviament inicial reconciliat amb Enviats', { idConversa: c.id_conversa });
      } else {
        Repositori.actualitzaMissatge(p.id_missatge, { estat_enviament: M_().ERROR });
        Repositori.actualitzaConversa(c.id_conversa, {
          estat: E_().ERROR,
          darrer_error: 'No consta l\'enviament inicial. Revisa Enviats; si no hi és, tanca la conversa (tancaConversa) i torna-la a iniciar.'
        });
        Registre.avis('Enviament inicial no trobat', { idConversa: c.id_conversa });
      }
      return false;
    }

    var coneguts = {};
    registrats.forEach(function (m) { if (m.gmail_message_id) coneguts[m.gmail_message_id] = true; });
    var desDe = Date.parse(p.data) - 60 * 1000;
    var candidats = Bustia.llegeixFil(c.gmail_thread_id, coneguts, propies).filter(function (d) {
      return d.propi && !d.conegut && d.data.getTime() >= desDe;
    });
    if (candidats.length > 0) {
      completaEnviament_(c.id_conversa, p.id_missatge, candidats[0].id, p.tanca_conversa);
      Registre.info('Resposta interrompuda reconciliada: ja s\'havia enviat', { idConversa: c.id_conversa });
      return !p.tanca_conversa;
    }
    Repositori.actualitzaMissatge(p.id_missatge, { estat_enviament: M_().ERROR });
    Repositori.actualitzaConversa(c.id_conversa, {
      estat: E_().ERROR,
      darrer_error: 'No consta que la resposta s\'enviés. Revisa el fil i executa reactivaConversa per tornar-ho a intentar.'
    });
    Registre.avis('Resposta interrompuda no trobada al fil; conversa en ERROR', { idConversa: c.id_conversa });
    return false;
  }

  // ------------------------------------------------- Operació manual

  function reactiva(idConversa) {
    var execucio = ambBloqueig_(function () {
      var c = Repositori.conversa(idConversa);
      if (!c) throw new Error('No existeix la conversa ' + idConversa + '.');
      if (c.estat !== E_().ERROR) throw new Error('Només es poden reactivar converses en ERROR (estat actual: ' + c.estat + ').');
      if (!c.gmail_thread_id) {
        throw new Error('La conversa no té fil de Gmail: atureu-la (Rèplica › Atura la conversa seleccionada, o tancaConversa) i torneu a iniciar la simulació.');
      }
      Repositori.actualitzaConversa(idConversa, { estat: E_().ACTIVA, darrer_error: '' });
      return { idConversa: idConversa, estat: E_().ACTIVA };
    });
    if (execucio.bloquejat) throw new Error('Hi ha una altra execució en curs. Torna-ho a provar d\'aquí a un minut.');
    return execucio.resultat;
  }

  function tanca(idConversa) {
    var execucio = ambBloqueig_(function () {
      var c = Repositori.conversa(idConversa);
      if (!c) throw new Error('No existeix la conversa ' + idConversa + '.');
      Repositori.actualitzaConversa(idConversa, { estat: E_().FINALITZADA });
      return { idConversa: idConversa, estat: E_().FINALITZADA };
    });
    if (execucio.bloquejat) throw new Error('Hi ha una altra execució en curs. Torna-ho a provar d\'aquí a un minut.');
    return execucio.resultat;
  }

  return {
    inicia: inicia,
    correusDisponibles: correusDisponibles,
    processaPendents: processaPendents,
    pendentsDeResposta: pendentsDeResposta,
    reactiva: reactiva,
    tanca: tanca
  };
})();
