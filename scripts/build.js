#!/usr/bin/env node
/**
 * Genera dist/Replica.gs: tot el codi de src/*.js en un sol fitxer, per a la
 * instal·lació copiant i enganxant a l'editor d'Apps Script.
 *
 * src/ és l'única font: no editeu mai dist/Replica.gs a mà.
 * npm test comprova que dist/Replica.gs està al dia.
 *
 *   node scripts/build.js
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ARREL = path.join(__dirname, '..');
const DIR_SRC = path.join(ARREL, 'src');
const SORTIDA = path.join(ARREL, 'dist', 'Replica.gs');

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
  return capcalera + '\n' + cos;
}

module.exports = { genera, SORTIDA };

if (require.main === module) {
  fs.mkdirSync(path.dirname(SORTIDA), { recursive: true });
  fs.writeFileSync(SORTIDA, genera());
  console.log('Generat ' + path.relative(ARREL, SORTIDA));
}
