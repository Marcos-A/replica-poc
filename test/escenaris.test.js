/**
 * Comprovacions de cada escenari de escenaris/*.json. Si n'afegiu un de nou,
 * aquestes proves detecten els errors més habituals abans de carregar-lo al full.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { llegeixEscenaris } = require('../scripts/build');
const { creaEntorn } = require('./entorn');

const e = creaEntorn();
e.g.preparaFulls();
const COLUMNES = e.full('Escenaris').dades[0];
const TEXTOS = ['titol', 'interlocutor', 'empresa', 'caracter', 'incidencia', 'objectiu_interlocutor',
  'limits_reservats', 'objectiu_participant', 'criteris', 'assumpte_inicial', 'missatge_inicial'];

test('Els identificadors són únics i coincideixen amb el nom del fitxer', () => {
  const ids = llegeixEscenaris().map(({ fitxer, escenari }) => {
    assert.match(escenari.id, /^ESC-\d{3}$/, fitxer + ': id ha de ser ESC-NNN');
    assert.equal(fitxer, escenari.id + '.json', fitxer + ': el fitxer s\'ha de dir ' + escenari.id + '.json');
    return escenari.id;
  });
  assert.equal(new Set(ids).size, ids.length, 'Hi ha identificadors repetits');
});

for (const { fitxer, escenari: x } of llegeixEscenaris()) {
  test(fitxer + ': té exactament les columnes de la pestanya Escenaris', () => {
    assert.deepEqual(Object.keys(x).sort(), [...COLUMNES].sort());
  });

  test(fitxer + ': valors vàlids', () => {
    TEXTOS.forEach((c) => {
      assert.equal(typeof x[c], 'string', c + ' ha de ser text');
      assert.ok(x[c].trim(), c + ' és buit');
      assert.equal(x[c], x[c].trim(), c + ' té espais al principi o al final');
      assert.doesNotMatch(x[c], /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, c + ' conté una adreça electrònica');
    });
    assert.equal(typeof x.actiu, 'boolean');
    assert.ok(['ca', 'es', 'en'].includes(x.idioma), 'idioma: ca, es o en');
    assert.ok(Number.isInteger(x.max_torns) && x.max_torns >= 1 && x.max_torns <= 12, 'max_torns: de 1 a 12');
    assert.match(x.interlocutor, /^[^,]+, [^,]+$/, 'interlocutor: «Nom Cognom, càrrec»');
  });

  test(fitxer + ': el correu inicial està ben format i signa com les respostes', () => {
    const m = x.missatge_inicial;
    assert.doesNotMatch(m, /\r/, 'salts de línia de Windows');
    m.split('\n').forEach((linia, i) => {
      assert.equal(linia, linia.trim(), 'línia ' + (i + 1) + ' amb espais al principi o al final: «' + linia + '»');
    });
    assert.doesNotMatch(m, /\n{3,}/, 'més d\'una línia en blanc seguida');
    assert.ok(m.endsWith('\n\n' + e.g.Gemini.signatura(x)),
      'ha d\'acabar amb la mateixa signatura que les respostes:\n' + e.g.Gemini.signatura(x));
  });
}
