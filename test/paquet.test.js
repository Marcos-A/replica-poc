/** Proves del fitxer únic dist/Replica.gs i de la detecció de codi incomplet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { genera, SORTIDA } = require('../scripts/build');
const { creaEntorn } = require('./entorn');

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
  const e = creaEntorn({ ometFitxers: ['GmailGateway.js', 'EscenariInicial.js'] });
  const r = e.g.comprovaConfiguracio(true);
  assert.equal(r.correcte, false);
  assert.match(r.text, /\[ERROR\] Codi: falta Bustia: .*src\/GmailGateway\.js al fitxer GmailGateway\.gs/);
  assert.match(r.text, /\[ERROR\] Codi: falta ESCENARI_INICIAL/);
  assert.doesNotMatch(r.text, /falta Config/);
});

test('Codi incomplet: preparaFulls s\'atura amb un missatge llegible', () => {
  const e = creaEntorn({ ometFitxers: ['Logger.js'] });
  assert.throws(() => e.g.preparaFulls(), /Codi incomplet a l'editor:\n- falta Registre/);
});
