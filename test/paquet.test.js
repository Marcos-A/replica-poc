/** Proves del fitxer únic dist/Replica.gs i de la detecció de codi incomplet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { genera, SORTIDA, generaEscenaris, SORTIDA_ESCENARIS } = require('../scripts/build');
const { creaEntorn } = require('./entorn');

test('src/Escenaris.js està al dia amb escenaris/ (si falla: npm run build)', () => {
  assert.equal(fs.readFileSync(SORTIDA_ESCENARIS, 'utf8'), generaEscenaris(),
    'src/Escenaris.js no coincideix amb escenaris/: executeu npm run build');
});

test('dist/Replica.gs està al dia amb src/ (si falla: npm run build)', () => {
  assert.ok(fs.existsSync(SORTIDA), 'Falta dist/Replica.gs: executeu npm run build');
  assert.equal(fs.readFileSync(SORTIDA, 'utf8'), genera(),
    'dist/Replica.gs no coincideix amb src/: executeu npm run build');
});

test('dist/Replica.gs funciona sol: prepara, comprova, inicia i respon', () => {
  const e = creaEntorn({ codi: fs.readFileSync(SORTIDA, 'utf8') });
  e.g.preparaFulls();
  assert.equal(e.g.comprovaConfiguracio(true).diagnostics[0].estat, 'OK');
  const r = e.g.iniciaSimulacio('docent.a@example.org', 'ESC-001');
  e.gmail.respon(r.threadId, 'docent.a@example.org', 'Us demanem disculpes; les caixes surten demà.');
  e.g.processaCorreusPendents();
  assert.equal(e.gmail.enviats.length, 2);
});

test('Codi incomplet: comprovaConfiguracio diu quin fitxer falta, sense petar', () => {
  const e = creaEntorn({ ometFitxers: ['GmailGateway.js', 'Escenaris.js'] });
  const r = e.g.comprovaConfiguracio(true);
  assert.equal(r.correcte, false);
  assert.match(r.text, /\[ERROR\] Codi: falta Bustia: .*src\/GmailGateway\.js al fitxer GmailGateway\.gs/);
  assert.match(r.text, /\[ERROR\] Codi: falta ESCENARIS: .*src\/Escenaris\.js/);
  assert.doesNotMatch(r.text, /falta Config/);
});

test('Codi incomplet: preparaFulls s\'atura amb un missatge llegible', () => {
  const e = creaEntorn({ ometFitxers: ['Logger.js'] });
  assert.throws(() => e.g.preparaFulls(), /Codi incomplet a l'editor:\n- falta Registre/);
});

test('dist/Replica.gs inclou el menú: vinculat al full, sense SPREADSHEET_ID', () => {
  const e = creaEntorn({ codi: fs.readFileSync(SORTIDA, 'utf8'), vinculat: true, propietats: { SPREADSHEET_ID: '' } });
  e.g.onOpen();
  assert.equal(e.ui.menu.titol, 'Rèplica');
  e.g.menuPreparaFull();
  assert.match(e.ui.darrer().text, /^Fet\. Canvis:/);
  e.g.menuComprovaConfiguracio();
  assert.match(e.ui.darrer().text, /\[OK\] Codi: tots els mòduls carregats/);
});

test('dist/Replica.gs acaba amb la marca final que cita el README', () => {
  const codi = fs.readFileSync(SORTIDA, 'utf8');
  const marca = '// ===== FI DE Replica.gs: si veieu aquesta línia, el fitxer és sencer =====';
  assert.equal(codi.trimEnd().split('\n').pop(), marca);
  assert.ok(fs.readFileSync(require('node:path').join(__dirname, '..', 'README.md'), 'utf8').includes('`' + marca + '`'));
});
