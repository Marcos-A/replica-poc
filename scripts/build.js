#!/usr/bin/env node
/**
 * Genera, per ordre:
 * 1. src/Escenaris.js, a partir dels fitxers escenaris/*.json (un per escenari).
 * 2. dist/Replica.gs: tot el codi de src/*.js en un sol fitxer, per a la
 *    instal·lació copiant i enganxant a l'editor d'Apps Script.
 *
 * Les fonts són escenaris/ i src/: no editeu mai a mà src/Escenaris.js ni
 * dist/Replica.gs. npm test comprova que tots dos estan al dia.
 *
 *   node scripts/build.js
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ARREL = path.join(__dirname, '..');
const DIR_SRC = path.join(ARREL, 'src');
const SORTIDA = path.join(ARREL, 'dist', 'Replica.gs');
const DIR_ESCENARIS = path.join(ARREL, 'escenaris');
const SORTIDA_ESCENARIS = path.join(DIR_SRC, 'Escenaris.js');

/** Escenaris de escenaris/*.json, ordenats pel nom del fitxer. */
function llegeixEscenaris() {
  return fs.readdirSync(DIR_ESCENARIS).filter((f) => f.endsWith('.json')).sort()
    .map((f) => ({ fitxer: f, escenari: JSON.parse(fs.readFileSync(path.join(DIR_ESCENARIS, f), 'utf8')) }));
}

function generaEscenaris() {
  const escenaris = llegeixEscenaris().map((e) => e.escenari);
  return [
    '/**',
    ' * FITXER GENERAT a partir de escenaris/*.json: no l\'editeu. Per afegir o',
    ' * canviar un escenari, editeu escenaris/ i executeu "npm run build".',
    ' *',
    ' * preparaFulls() afegeix a la pestanya Escenaris els que encara no hi són',
    ' * (per id). No modifica mai les files que ja hi ha. Dades inventades.',
    ' */',
    'var ESCENARIS = ' + JSON.stringify(escenaris, null, 2) + ';',
    ''
  ].join('\n');
}

function genera() {
  const versio = JSON.parse(fs.readFileSync(path.join(ARREL, 'package.json'), 'utf8')).version;
  const fitxers = fs.readdirSync(DIR_SRC).filter((f) => f.endsWith('.js')).sort();
  const capcalera = [
    '/**',
    ' * Rèplica · prova de concepte · versió ' + versio,
    ' * https://github.com/Marcos-A/replica-poc',
    ' *',
    ' * FITXER GENERAT: no l\'editeu. Editeu els fitxers de src/ i executeu',
    ' * "npm run build". Conté, per ordre: ' + fitxers.join(', ') + '.',
    ' *',
    ' * Instal·lació: enganxeu aquest fitxer sencer en un sol fitxer de',
    ' * l\'editor d\'Apps Script (Replica.gs), juntament amb appsscript.json.',
    ' */',
    ''
  ].join('\n');
  const cos = fitxers.map((f) => {
    const codi = fs.readFileSync(path.join(DIR_SRC, f), 'utf8').replace(/\s+$/, '');
    return '// ===== src/' + f + ' =====\n\n' + codi + '\n';
  }).join('\n');
  // Marca final fixa: permet comprovar a l'editor que s'ha enganxat sencer.
  const final = '\n// ===== FI DE Replica.gs: si veieu aquesta línia, el fitxer és sencer =====\n';
  return capcalera + '\n' + cos + final;
}

module.exports = { genera, SORTIDA, generaEscenaris, SORTIDA_ESCENARIS, llegeixEscenaris };

if (require.main === module) {
  fs.writeFileSync(SORTIDA_ESCENARIS, generaEscenaris());
  console.log('Generat ' + path.relative(ARREL, SORTIDA_ESCENARIS));
  fs.mkdirSync(path.dirname(SORTIDA), { recursive: true });
  fs.writeFileSync(SORTIDA, genera());
  console.log('Generat ' + path.relative(ARREL, SORTIDA));
}
