/**
 * Proves del menú «Rèplica», del projecte vinculat al full, de la
 * comprovació del compte i de la clau desada al compte de prova.
 * Cap prova envia correus reals ni crida Gemini.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { creaEntorn } = require('./entorn');

const PARTICIPANT = 'docent.a@example.org';
const COLLEGA = 'docent.b@example.org';
const CLAU_NOVA = 'AIzaNOVAnovaNOVAnova1234567890';

/** Projecte vinculat al full, sense SPREADSHEET_ID, amb el full preparat. */
function entornMenu(opcions = {}) {
  const e = creaEntorn(Object.assign({ vinculat: true }, opcions, {
    propietats: Object.assign({ SPREADSHEET_ID: '' }, opcions.propietats || {})
  }));
  if (opcions.sensePreparar !== true) e.g.preparaFulls();
  return e;
}

/** Envia una activació des del menú (selecciona la fila i confirma). Retorna la fila. */
function enviaActivacio(e, destinataris, escenari = 'ESC-001') {
  const fila = e.novaActivacio(escenari, destinataris);
  e.llibre.selecciona('Activacions', fila);
  e.g.menuEnviaActivacio();
  return fila;
}

/** Inicia una conversa amb el participant i la deixa a la fila 2 de Converses. */
function ambConversa(e) {
  enviaActivacio(e, PARTICIPANT);
  return e.converses()[0];
}

// ------------------------------------------------------------ Menú

test('Menú: onOpen crea el menú Rèplica i cada opció crida una funció que existeix', () => {
  const e = entornMenu();
  e.g.onOpen();
  assert.equal(e.ui.menu.titol, 'Rèplica');
  const opcions = e.ui.opcions();
  assert.equal(opcions.length, 12);
  opcions.forEach(([text, funcio]) => assert.equal(typeof e.g[funcio], 'function', text + ' → ' + funcio));
  const funcions = opcions.map((o) => o[1]);
  ['menuEnviaActivacio', 'menuRevisaAra', 'menuAturaConversa', 'menuReactivaConversa', 'menuReobreConversa', 'menuEstatConverses',
    'menuCreaDisparador', 'menuEliminaDisparadors', 'menuComprovaConfiguracio',
    'menuPreparaFull', 'menuDesaClauGemini'].forEach((f) => assert.ok(funcions.includes(f), f));
});

test('Menú: l\'opció de l\'interruptor mostra l\'estat actual', () => {
  const e = entornMenu();
  e.g.onOpen();
  let textos = e.ui.opcions().map((o) => o[0]);
  assert.ok(textos.includes('Simulacions ACTIVADES · Atura-les totes…'));
  assert.ok(!textos.some((t) => /Activa-les/.test(t)));
  e.propietats.SIMULATION_ENABLED = 'false';
  e.g.onOpen();
  textos = e.ui.opcions().map((o) => o[0]);
  assert.ok(textos.includes('Simulacions ATURADES · Activa-les…'));
});

test('Menú: no es mostra a un compte que se sap que no és el de prova', () => {
  const e = entornMenu({ usuariActiu: COLLEGA });
  e.g.onOpen();
  assert.equal(e.ui.menu, null);
  // Amb comptes de Gmail, l'activador simple no sap l'adreça: el menú es mostra.
  const f = entornMenu({ usuariActiu: '' });
  f.g.onOpen();
  assert.equal(f.ui.menu.titol, 'Rèplica');
});

// ----------------------------------------------------- Compte de prova

test('Compte: si hi fa clic un altre compte, no s\'envia res i s\'explica per què', () => {
  const e = entornMenu({ usuari: COLLEGA });
  enviaActivacio(e, PARTICIPANT);
  assert.equal(e.gmail.enviats.length, 0);
  assert.match(e.ui.darrer().text, /Només el compte de prova \(b\*\*\*@example\.org\)/);
  assert.match(e.ui.darrer().text, /els correus sortirien d'aquest compte/);
  assert.equal(e.ui.dialegs.filter((d) => d.botons === 'YES_NO').length, 0, 'no ha de demanar confirmació');
  // Tampoc des de l'editor.
  assert.throws(() => e.g.iniciaSimulacio(PARTICIPANT, 'ESC-001'), /Només el compte de prova/);
  assert.throws(() => e.g.creaDisparador(), /Només el compte de prova/);
  assert.throws(() => e.g.enviaActivacioPendent(), /Només el compte de prova/);
  assert.equal(e.disparadors.length, 0);
});

test('Compte: un disparador creat per un altre compte no llegeix ni envia res', () => {
  const e = entornMenu();
  ambConversa(e);
  const conversa = e.converses()[0];
  e.gmail.respon(conversa.gmail_thread_id, PARTICIPANT, 'Us demanem disculpes.');
  const altre = Object.assign(e.g.Session, {});
  altre.getEffectiveUser = () => ({ getEmail: () => COLLEGA });
  const r = e.g.processaCorreusPendents();
  assert.equal(r.estat, 'COMPTE_INCORRECTE');
  assert.equal(e.gmail.enviats.length, 1, 'només el correu inicial');
  assert.ok(e.registres.some((l) => /Revisió omesa: Només el compte de prova/.test(l)));
});

test('Compte: un full sense propietari (unitat compartida) s\'explica', () => {
  const e = entornMenu({ propietari: null });
  e.g.menuEstatConverses();
  assert.match(e.ui.darrer().text, /unitat compartida/);
  const r = e.g.comprovaConfiguracio(true);
  assert.equal(r.correcte, false);
  assert.match(r.text, /\[ERROR\] Compte: No es pot saber de qui és el full/);
});

// -------------------------------------------------- Projecte vinculat

test('Vinculat: sense SPREADSHEET_ID fa servir el full on està instal·lat', () => {
  const e = entornMenu();
  e.g.creaDisparador(5);
  const r = e.g.comprovaConfiguracio(true);
  assert.equal(r.correcte, true, r.text);
  assert.match(r.text, /\[OK\] Full de càlcul: el programa està instal·lat al full «Rèplica – dades» \(no cal SPREADSHEET_ID\)/);
  assert.match(r.text, /\[OK\] Compte: el programa s'executa amb el compte de prova/);
  assert.doesNotMatch(r.text, /Propietat SPREADSHEET_ID/);
});

test('Vinculat: SPREADSHEET_ID igual és innecessari; diferent és un error', () => {
  const igual = entornMenu({ propietats: { SPREADSHEET_ID: 'full-de-prova' } });
  assert.match(igual.g.comprovaConfiguracio(true).text, /\[INFO\] Propietat SPREADSHEET_ID: és el mateix full/);
  const diferent = creaEntorn({ vinculat: true, propietats: { SPREADSHEET_ID: 'un-altre-full' } });
  const r = diferent.g.comprovaConfiguracio(true);
  assert.equal(r.correcte, false);
  assert.match(r.text, /\[ERROR\] Propietat SPREADSHEET_ID: apunta a un full diferent/);
});

test('Independent: sense SPREADSHEET_ID ni full vinculat, error llegible', () => {
  const e = creaEntorn({ propietats: { SPREADSHEET_ID: '' } });
  const r = e.g.comprovaConfiguracio(true);
  assert.equal(r.correcte, false);
  assert.match(r.text, /\[ERROR\] Propietat SPREADSHEET_ID: falta: .*Extensions › Apps Script/);
  assert.throws(() => e.g.preparaFulls(), /No se sap quin full de càlcul fer servir/);
});

// --------------------------------------------- Pestanya Configuració

test('Configuració: «Prepara el full» actualitza les descripcions antigues sense tocar els valors', () => {
  const e = entornMenu();
  const full = e.full('Configuració');
  const fila = full.dades.find((f) => f[0] === 'interval_minuts');
  fila[1] = 15;
  fila[2] = 'Descripció antiga';
  e.g.menuPreparaFull();
  assert.match(e.ui.darrer().text, /Descripcions actualitzades a Configuració: 1/);
  assert.equal(e.parametre('interval_minuts'), 15);
  assert.match(fila[2], /^Cada quants minuts es revisa la bústia/);
  e.g.menuPreparaFull();
  assert.match(e.ui.darrer().text, /no s'ha canviat res/);
});

// ------------------------------------------------------- Activacions

test('Activació: envia un correu separat a cada destinatari i ho anota a la fila', () => {
  const e = entornMenu();
  const fila = enviaActivacio(e, 'docent.a@example.org,\nDocent.B@example.org');
  const confirmacio = e.ui.dialegs.find((d) => d.botons === 'YES_NO');
  assert.match(confirmacio.text, /Activació: nova \(fila 2\)\nEscenari: ESC-001 · /);
  assert.match(confirmacio.text, /a 2 persona\(es\), cadascuna en un fil separat/);
  assert.match(confirmacio.text, /• docent\.a@example\.org\n• docent\.b@example\.org/);

  assert.equal(e.gmail.enviats.length, 2);
  assert.deepEqual(e.gmail.enviats.map((m) => m.a), ['docent.a@example.org', 'docent.b@example.org']);
  assert.notEqual(e.gmail.enviats[0].fil, e.gmail.enviats[1].fil);
  assert.deepEqual(e.converses().map((c) => [c.correu_participant, c.id_activacio, c.estat]),
    [['docent.a@example.org', 'ACT-001', 'ACTIVA'], ['docent.b@example.org', 'ACT-001', 'ACTIVA']]);
  const act = e.activacions()[0];
  assert.equal(act.id_activacio, 'ACT-001');
  assert.equal(act.estat, 'ENVIADA');
  assert.equal(act.resultat, '2 enviat(s)');
  assert.ok(act.data_enviament);
  assert.match(e.ui.darrer().text, /^Fet\.\n\nActivació: ACT-001\nCorreus enviats: 2/);

  // La mateixa fila no es torna a enviar.
  e.llibre.selecciona('Activacions', fila);
  e.g.menuEnviaActivacio();
  assert.match(e.ui.darrer().text, /ja s'ha enviat\. Per enviar el correu inicial a més persones, afegiu una fila nova/);
  assert.equal(e.gmail.enviats.length, 2);
});

test('Activació: amb una sola persona, i ometent qui ja té una conversa oberta', () => {
  const e = entornMenu();
  enviaActivacio(e, PARTICIPANT);
  assert.equal(e.gmail.enviats.length, 1);
  enviaActivacio(e, PARTICIPANT + ', ' + COLLEGA);
  const confirmacio = e.ui.dialegs.filter((d) => d.botons === 'YES_NO').pop();
  assert.match(confirmacio.text, /Activació: nova \(fila 3\)/);
  assert.match(confirmacio.text, /No s'enviarà a:\n• docent\.a@example\.org \(ja té una conversa oberta d'aquest escenari\)/);
  assert.equal(e.gmail.enviats.length, 2);
  assert.equal(e.activacions()[1].id_activacio, 'ACT-002');
  assert.match(e.activacions()[1].resultat, /^1 enviat\(s\) · 1 omès\/omesos: docent\.a@example\.org/);
  enviaActivacio(e, PARTICIPANT);
  assert.match(e.ui.darrer().text, /^No cal enviar res\./);
  assert.equal(e.activacions()[2].estat, '');
});

test('Activació: si alguna adreça no és correcta, no s\'envia res i es diu quina', () => {
  const e = entornMenu();
  enviaActivacio(e, PARTICIPANT + ', intrus@example.org');
  assert.match(e.ui.darrer().text, /no són a la pestanya Participants, o no hi tenen marcada la casella actiu:\n• intrus@example\.org/);
  assert.match(e.ui.darrer().text, /No s'ha enviat res/);
  e.marcaParticipant(COLLEGA, false);
  enviaActivacio(e, COLLEGA);
  assert.match(e.ui.darrer().text, /• docent\.b@example\.org/);
  enviaActivacio(e, PARTICIPANT + ' docent.a@example');
  assert.match(e.ui.darrer().text, /no són vàlides[\s\S]*• docent\.a@example/);
  enviaActivacio(e, '');
  assert.match(e.ui.darrer().text, /Escriviu almenys una adreça/);
  enviaActivacio(e, PARTICIPANT, '');
  assert.match(e.ui.darrer().text, /Trieu l'escenari/);
  enviaActivacio(e, PARTICIPANT, 'ESC-999');
  assert.match(e.ui.darrer().text, /ESC-999 no existeix/);
  assert.equal(e.gmail.enviats.length, 0);
  assert.equal(e.ui.dialegs.filter((d) => d.botons === 'YES_NO').length, 0);
  assert.ok(e.activacions().every((a) => a.estat === '' && a.id_activacio === ''));
});

test('Activació: interruptor apagat, confirmació negativa i selecció incorrecta', () => {
  const e = entornMenu({ propietats: { SIMULATION_ENABLED: 'false' } });
  enviaActivacio(e, PARTICIPANT);
  assert.match(e.ui.darrer().text, /Les simulacions estan aturades/);
  e.propietats.SIMULATION_ENABLED = 'true';
  e.ui.respostes.push('NO');
  enviaActivacio(e, PARTICIPANT);
  assert.equal(e.gmail.enviats.length, 0);
  e.llibre.selecciona('Converses', 2);
  e.g.menuEnviaActivacio();
  assert.match(e.ui.darrer().text, /és a la pestanya «Converses»[\s\S]*Aneu a la pestanya Activacions/);
  e.llibre.selecciona('Activacions', 9);
  e.g.menuEnviaActivacio();
  assert.match(e.ui.darrer().text, /La fila 9 és buida/);
  assert.equal(e.gmail.enviats.length, 0);
});

test('Activació: si un enviament falla, queda PARCIAL i no es reenvia a qui ja és en curs', () => {
  const e = entornMenu();
  e.gmail.fallaEnviament = 'abans';
  const fila = enviaActivacio(e, PARTICIPANT);
  assert.match(e.ui.darrer().text, /^Enviament incomplet\.[\s\S]*No s'ha pogut enviar a:\n• docent\.a@example\.org/);
  assert.equal(e.activacions()[0].estat, 'PARCIAL');
  assert.match(e.activacions()[0].resultat, /0 enviat\(s\) · 1 amb error/);
  // La conversa queda en PROCESSANT (el processador la reconciliarà): no es torna a enviar.
  e.gmail.fallaEnviament = null;
  e.llibre.selecciona('Activacions', fila);
  e.g.menuEnviaActivacio();
  assert.match(e.ui.darrer().text, /No cal enviar res[\s\S]*ja l'havia rebut en aquesta activació/);
});

test('Activació: des de l\'editor, enviaActivacioPendent envia la primera fila pendent', () => {
  const e = entornMenu();
  assert.throws(() => e.g.enviaActivacioPendent(), /No hi ha cap activació per enviar/);
  e.novaActivacio('ESC-001', PARTICIPANT);
  e.novaActivacio('ESC-001', COLLEGA);
  const r = e.g.enviaActivacioPendent();
  assert.equal(r.idActivacio, 'ACT-001');
  assert.deepEqual([...r.enviats], [PARTICIPANT]);
  assert.equal(e.g.enviaActivacioPendent().idActivacio, 'ACT-002');
});

test('Límit diari: una activació que el passaria no s\'envia, i les respostes esperen', () => {
  const e = entornMenu();
  const c = ambConversa(e);
  // 98 correus més en les darreres 24 hores: 99 de 100.
  const missatges = e.full('Missatges');
  const cap = missatges.dades[0];
  for (let i = 0; i < 98; i++) {
    const f = cap.map(() => '');
    f[cap.indexOf('id_missatge')] = 'antic' + i;
    f[cap.indexOf('rol')] = 'interlocutor';
    f[cap.indexOf('estat_enviament')] = 'ENVIAT';
    f[cap.indexOf('data')] = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    missatges.dades.push(f);
  }
  enviaActivacio(e, COLLEGA);
  assert.match(e.ui.darrer().text, /Fet\./, 'un sol correu encara hi cap');
  assert.equal(e.gmail.enviats.length, 2);
  e.g.Repositori.actualitzaConversa(e.converses()[1].id_conversa, { estat: 'FINALITZADA' });
  enviaActivacio(e, COLLEGA);
  assert.match(e.ui.darrer().text, /enviaria 1 correus, però en les properes hores només en queden 0 \(límit de 100/);
  assert.equal(e.gmail.enviats.length, 2);

  e.gmail.respon(c.gmail_thread_id, PARTICIPANT, 'Us demanem disculpes.');
  e.g.menuRevisaAra();
  assert.match(e.ui.darrer().text, /Respostes en espera pel límit de correus diari: 1/);
  assert.equal(e.gmail.enviats.length, 2);
  assert.equal(e.peticionsIA().length, 0, 'no es crida la IA si no es pot enviar');
  assert.equal(e.converses()[0].estat, 'ACTIVA');
  assert.match(e.g.comprovaConfiguracio(true).text, /\[AVÍS\] Configuració › correus_per_dia: 100 correus en 24 hores; se n'han enviat 100 i en queden 0/);

  // Amb un compte de Workspace (1500), la resposta surt.
  e.configura('correus_per_dia', 1500);
  e.g.menuRevisaAra();
  assert.match(e.ui.darrer().text, /Respostes enviades: 1/);
  assert.equal(e.gmail.enviats.length, 3);
});

// ---------------------------------------------- Conversa seleccionada

test('Selecció: sense fila vàlida, explica què cal fer', () => {
  const e = entornMenu();
  ambConversa(e);
  e.llibre.seleccio = null;
  e.g.menuAturaConversa();
  assert.match(e.ui.darrer().text, /No hi ha cap cel·la seleccionada/);
  e.llibre.selecciona('Configuració', 2);
  e.g.menuAturaConversa();
  assert.match(e.ui.darrer().text, /és a la pestanya «Configuració»/);
  e.llibre.selecciona('Converses', 1);
  e.g.menuAturaConversa();
  assert.match(e.ui.darrer().text, /Heu seleccionat la capçalera/);
  e.llibre.selecciona('Converses', 2, 2);
  e.g.menuAturaConversa();
  assert.match(e.ui.darrer().text, /Heu seleccionat 2 files/);
  e.llibre.selecciona('Converses', 7);
  e.g.menuAturaConversa();
  assert.match(e.ui.darrer().text, /La fila 7 és buida/);
  assert.equal(e.converses()[0].estat, 'ACTIVA');
});

test('Atura la conversa seleccionada: confirma i la deixa FINALITZADA', () => {
  const e = entornMenu();
  const c = ambConversa(e);
  e.llibre.selecciona('Converses', 2);
  e.ui.respostes.push('NO');
  e.g.menuAturaConversa();
  assert.equal(e.converses()[0].estat, 'ACTIVA');
  e.g.menuAturaConversa();
  assert.equal(e.converses()[0].estat, 'FINALITZADA');
  assert.match(e.ui.darrer().text, new RegExp('Conversa ' + c.id_conversa + ' aturada'));
  e.g.menuAturaConversa();
  assert.match(e.ui.darrer().text, /ja està finalitzada/);
});

test('Atura: també funciona seleccionant un missatge de la conversa', () => {
  const e = entornMenu();
  ambConversa(e);
  e.llibre.selecciona('Missatges', 2);
  e.g.menuAturaConversa();
  assert.equal(e.converses()[0].estat, 'FINALITZADA');
});

test('Reactiva la conversa seleccionada: només en ERROR i després d\'avisar de revisar el fil', () => {
  const e = entornMenu();
  const c = ambConversa(e);
  e.llibre.selecciona('Converses', 2);
  e.g.menuReactivaConversa();
  assert.match(e.ui.darrer().text, /Només es poden reactivar les converses en estat ERROR/);

  e.g.Repositori.actualitzaConversa(c.id_conversa, { estat: 'ERROR', darrer_error: 'HTTP 403' });
  e.ui.respostes.push('NO');
  e.g.menuReactivaConversa();
  assert.equal(e.converses()[0].estat, 'ERROR');
  assert.match(e.ui.darrer().text, /comproveu que la darrera resposta de la clienta NO s'ha enviat/);
  e.g.menuReactivaConversa();
  assert.equal(e.converses()[0].estat, 'ACTIVA');
  assert.equal(e.converses()[0].darrer_error, '');
});

test('Reobre la conversa seleccionada: només finalitzades, demana quantes respostes i valida el nombre', () => {
  const e = entornMenu();
  const c = ambConversa(e);
  e.llibre.selecciona('Converses', 2);
  e.g.menuReobreConversa();
  assert.match(e.ui.darrer().text, /Només es poden reobrir les converses finalitzades/);

  e.g.tancaConversa(c.id_conversa);
  e.ui.textos.push(['CANCEL', ''], ['OK', 'tres'], ['OK', '9']);
  e.g.menuReobreConversa();
  e.g.menuReobreConversa();
  assert.match(e.ui.darrer().text, /«tres» no és vàlid/);
  e.g.menuReobreConversa();
  assert.match(e.ui.darrer().text, /«9» no és vàlid/);
  assert.equal(e.converses()[0].estat, 'FINALITZADA');

  e.ui.textos.push(['OK', '']);
  e.g.menuReobreConversa();
  assert.equal(e.converses()[0].estat, 'ACTIVA');
  assert.equal(e.converses()[0].max_torns_conversa, '2');
  assert.match(e.ui.darrer().text, /pot enviar 2 resposta\(es\) més \(fins a 2 en total\)/);
});

test('Reobre: una conversa en ERROR remet a Reactiva', () => {
  const e = entornMenu();
  const c = ambConversa(e);
  e.g.Repositori.actualitzaConversa(c.id_conversa, { estat: 'ERROR', darrer_error: 'x' });
  e.llibre.selecciona('Converses', 2);
  e.g.menuReobreConversa();
  assert.match(e.ui.darrer().text, /Reactiva la conversa seleccionada/);
});

// ------------------------------------------------- Interruptor i revisió

test('Activa / Atura: confirmen, canvien l\'interruptor i actualitzen el menú', () => {
  const e = entornMenu();
  e.g.onOpen();
  e.ui.respostes.push('NO');
  e.g.menuAturaSimulacions();
  assert.equal(e.propietats.SIMULATION_ENABLED, 'true');
  e.g.menuAturaSimulacions();
  assert.equal(e.propietats.SIMULATION_ENABLED, 'false');
  assert.ok(e.ui.opcions().some((o) => o[0] === 'Simulacions ATURADES · Activa-les…'));
  e.g.menuActivaSimulacions();
  assert.equal(e.propietats.SIMULATION_ENABLED, 'true');
  assert.match(e.ui.darrer().text, /encara no hi ha revisió automàtica/);
  assert.ok(e.ui.opcions().some((o) => o[0] === 'Simulacions ACTIVADES · Atura-les totes…'));
});

test('Revisió automàtica: es crea amb l\'interval de la pestanya i s\'elimina amb confirmació', () => {
  const e = entornMenu();
  e.configura('interval_minuts', 10);
  e.g.menuCreaDisparador();
  assert.equal(e.disparadors.length, 1);
  assert.equal(e.disparadors[0].minuts, 10);
  assert.match(e.ui.darrer().text, /cada 10 minut\(s\)/);
  e.ui.respostes.push('NO');
  e.g.menuEliminaDisparadors();
  assert.equal(e.disparadors.length, 1);
  e.g.menuEliminaDisparadors();
  assert.equal(e.disparadors.length, 0);
  assert.match(e.ui.darrer().text, /Revisió automàtica eliminada/);
});

test('Revisa ara: respon i resumeix; amb l\'interruptor apagat, ho diu', () => {
  const e = entornMenu();
  e.g.menuRevisaAra();
  assert.match(e.ui.darrer().text, /No hi ha cap conversa activa/);
  const c = ambConversa(e);
  e.gmail.respon(c.gmail_thread_id, PARTICIPANT, 'Us demanem disculpes; les caixes surten demà.');
  e.g.menuRevisaAra();
  assert.match(e.ui.darrer().text, /Converses revisades: 1\nRespostes enviades: 1/);
  assert.equal(e.gmail.enviats.length, 2);
  e.propietats.SIMULATION_ENABLED = 'false';
  e.g.menuRevisaAra();
  assert.match(e.ui.darrer().text, /Les simulacions estan aturades: no s'ha revisat res/);
});

test('Comprova i Estat: mostren el resultat en un diàleg, sense la clau ni adreces completes', () => {
  const e = entornMenu();
  ambConversa(e);
  e.g.menuComprovaConfiguracio();
  assert.equal(e.ui.darrer().titol, 'Configuració correcta');
  assert.match(e.ui.darrer().text, /^Tot correcte\.[\s\S]*\[AVÍS\] Disparador/);
  e.propietats.GEMINI_MODEL = '';
  e.g.menuComprovaConfiguracio();
  assert.equal(e.ui.darrer().titol, 'Cal corregir alguna cosa');
  assert.match(e.ui.darrer().text, /\[ERROR\] Propietat GEMINI_MODEL: falta/);
  e.propietats.GEMINI_MODEL = 'gemini-model-de-prova';
  e.g.menuEstatConverses();
  const estat = e.ui.darrer().text;
  assert.match(estat, /Simulacions: ACTIVADES/);
  assert.match(estat, /Revisió automàtica: no n'hi ha/);
  assert.match(estat, /1 actives/);
  assert.match(estat, /d\*\*\*@example\.org · ACTIVA/);
  const tot = e.ui.dialegs.map((d) => d.text).join('\n');
  assert.doesNotMatch(tot, /AIzaFALSA/);
});

// ------------------------------------------------------ Clau de Gemini

test('Clau: «Desa la clau de Gemini» la passa al compte de prova i l\'esborra de les propietats', () => {
  const e = entornMenu();
  let r = e.g.comprovaConfiguracio(true);
  assert.match(r.text, /\[AVÍS\] Clau de Gemini: és a les Propietats de l'script, on la pot veure qualsevol/);

  e.ui.textos.push(['OK', '  ' + CLAU_NOVA + '  ']);
  e.g.menuDesaClauGemini();
  assert.equal(e.propietatsUsuari.GEMINI_API_KEY, CLAU_NOVA);
  assert.equal('GEMINI_API_KEY' in e.propietats, false);
  assert.match(e.ui.darrer().text, /Clau desada\. S'ha esborrat de les Propietats de l'script\.\n\nComprovació amb Gemini: correcta/);
  r = e.g.comprovaConfiguracio(true);
  assert.match(r.text, /\[OK\] Clau de Gemini: desada al compte de prova/);

  // La resposta de la clienta fa servir la clau nova.
  const c = ambConversa(e);
  e.gmail.respon(c.gmail_thread_id, PARTICIPANT, 'Us demanem disculpes.');
  e.g.processaCorreusPendents();
  assert.equal(e.peticionsIA()[0].opcions.headers['x-goog-api-key'], CLAU_NOVA);
  const tot = e.ui.dialegs.map((d) => d.text).join('\n') + e.registres.join('\n');
  assert.doesNotMatch(tot, /AIzaNOVA/);
});

test('Clau: cancel·lar, deixar-la buida o enganxar un text incorrecte no canvia res', () => {
  const e = entornMenu();
  e.ui.textos.push(['CANCEL', CLAU_NOVA], ['OK', '   '], ['OK', 'no és una clau']);
  e.g.menuDesaClauGemini();
  e.g.menuDesaClauGemini();
  assert.match(e.ui.darrer().text, /No heu enganxat cap clau/);
  e.g.menuDesaClauGemini();
  assert.match(e.ui.darrer().text, /Això no sembla una clau de Gemini/);
  assert.deepEqual(e.propietatsUsuari, {});
  assert.equal(e.propietats.GEMINI_API_KEY, 'AIzaFALSAfalsaFALSAfalsa1234567890');
});

test('Clau: sense clau enlloc, el diagnòstic diu com desar-la', () => {
  const e = entornMenu({ propietats: { GEMINI_API_KEY: '' } });
  const r = e.g.comprovaConfiguracio(true);
  assert.match(r.text, /\[ERROR\] Clau de Gemini: falta: deseu-la amb Rèplica › Configuració › Desa la clau de Gemini/);
});
