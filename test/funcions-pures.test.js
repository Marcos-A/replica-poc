/** Proves de funcions pures (sense estat). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { creaEntorn } = require('./entorn');

const { g } = creaEntorn();

test('extreuAdreca', () => {
  assert.equal(g.Bustia.extreuAdreca('Marta Soler <Marta@Example.org>'), 'marta@example.org');
  assert.equal(g.Bustia.extreuAdreca('docent@example.org'), 'docent@example.org');
  assert.equal(g.Bustia.extreuAdreca('"Cognom, Nom" <a@b.cat>'), 'a@b.cat');
});

test('netejaCos: elimina cites, signatures i peus de mòbil', () => {
  const net = g.Bustia.netejaCos([
    'Benvolguda Sra. Soler,', '', 'Us enviem les caixes demà.', '', '--', 'Docent A', 'Telèfon 600000000', '',
    'El dc., 19 de nov. 2026 a les 10:00, Marta Soler <x@y.cat> va escriure:', '> Bon dia'
  ].join('\r\n'));
  assert.equal(net, 'Benvolguda Sra. Soler,\n\nUs enviem les caixes demà.');
  assert.equal(g.Bustia.netejaCos('Hola\n\nEnviat des del meu iPhone'), 'Hola');
  assert.equal(g.Bustia.netejaCos('Text\nOn Wed, Nov 19, 2026 at 10:00 AM Marta\n<x@y.cat> wrote:\n> cita'), 'Text');
  assert.equal(g.Bustia.netejaCos('Text\n\nDe: Marta Soler\nEnviat: dimecres\nPer a: jo\nAssumpte: x'), 'Text');
  assert.equal(g.Bustia.netejaCos('a'.repeat(5000)).length, 4000 + ' […]'.length);
});

test('esAutomatic', () => {
  const cap = (h) => (nom) => h[nom] || '';
  assert.equal(g.Bustia.esAutomatic({ adreca: 'mailer-daemon@googlemail.com', assumpte: 'x' }), true);
  assert.equal(g.Bustia.esAutomatic({ adreca: 'noreply@x.cat', assumpte: 'x' }), true);
  assert.equal(g.Bustia.esAutomatic({ adreca: 'a@x.cat', assumpte: 'Resposta automàtica: Re: Reclamació' }), true);
  assert.equal(g.Bustia.esAutomatic({ adreca: 'a@x.cat', assumpte: 'Re: Automatic reply' }), true);
  assert.equal(g.Bustia.esAutomatic({ adreca: 'a@x.cat', assumpte: 'Re: x', capcalera: cap({ 'Auto-Submitted': 'auto-replied' }) }), true);
  assert.equal(g.Bustia.esAutomatic({ adreca: 'a@x.cat', assumpte: 'Re: x', capcalera: cap({ 'Auto-Submitted': 'no' }) }), false);
  assert.equal(g.Bustia.esAutomatic({ adreca: 'a@x.cat', assumpte: 'Re: x', capcalera: cap({ Precedence: 'bulk' }) }), true);
  assert.equal(g.Bustia.esAutomatic({ adreca: 'a@x.cat', assumpte: 'Re: Reclamació' }), false);
});

test('analitzaRemitents i esCorreuValid', () => {
  assert.deepEqual(Array.from(g.Config.analitzaRemitents(' A@x.cat, b@y.cat ;c@z.cat\n')), ['a@x.cat', 'b@y.cat', 'c@z.cat']);
  assert.equal(g.Config.esCorreuValid('a@x.cat'), true);
  assert.equal(g.Config.esCorreuValid('no-valid'), false);
});

test('Gemini.interpretaResposta: format steps, outputs i blocs de codi', () => {
  const steps = JSON.stringify({ status: 'completed', steps: [
    { type: 'thought', content: [{ type: 'text', text: 'pensament' }] },
    { type: 'model_output', content: [{ type: 'text', text: '```json\n{"resposta":"**Bon dia**, gràcies.","finalitzada":false}\n```' }] }
  ] });
  const r = g.Gemini.interpretaResposta(200, steps);
  assert.equal(r.text, 'Bon dia, gràcies.');
  assert.equal(r.finalitzada, false);
  const outputs = JSON.stringify({ outputs: [{ type: 'text', text: '{"resposta":"Hola","finalitzada":true}' }] });
  assert.equal(g.Gemini.interpretaResposta(200, outputs).finalitzada, true);
});

test('Gemini: el correu es munta per parts amb paràgrafs i signatura', () => {
  const escenari = { interlocutor: 'Laura Vidal, propietària', empresa: 'Estudi Creatiu Vidal' };
  assert.equal(g.Gemini.signatura(escenari), 'Laura Vidal\nPropietària\nEstudi Creatiu Vidal');
  const cos = JSON.stringify({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify({
    salutacio: 'Hola Marcos,',
    paragrafs: ['Gràcies per la rapidesa.', '  ', 'La franja de demà ens va bé.'],
    comiat: 'Salutacions, Laura Vidal, propietària',
    finalitzada: true
  }) }] }] });
  const r = g.Gemini.interpretaResposta(200, cos, escenari);
  assert.equal(r.text, 'Hola Marcos,\n\nGràcies per la rapidesa.\n\nLa franja de demà ens va bé.\n\n' +
    'Salutacions,\nLaura Vidal\nPropietària\nEstudi Creatiu Vidal');
  assert.equal(r.finalitzada, true);
});

test('Gemini.interpretaResposta: errors classificats', () => {
  const reintentable = (codi, cos) => {
    try { g.Gemini.interpretaResposta(codi, cos); } catch (e) { return e.reintentable; }
    assert.fail('Havia de llançar un error');
  };
  assert.equal(reintentable(429, '{}'), true);
  assert.equal(reintentable(503, 'x'), true);
  assert.equal(reintentable(400, '{"error":{"message":"bad"}}'), false);
  assert.equal(reintentable(403, '{}'), false);
  assert.equal(reintentable(200, '{"status":"failed"}'), true);
  assert.equal(reintentable(200, JSON.stringify({ steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"resposta":"x"}' }] }] })), true);
});

test('ProveidorIA.validaSortida: rebutja textos buits o massa llargs', () => {
  assert.throws(() => g.ProveidorIA.validaSortida({ text: '  ', finalitzada: false }), /buida/);
  assert.throws(() => g.ProveidorIA.validaSortida({ text: 'x'.repeat(3000), finalitzada: false }), /límit/);
  assert.throws(() => g.ProveidorIA.validaSortida({ text: 'Text prou llarg per ser vàlid.', finalitzada: 'no' }), /finalitzat/);
});

test('Gemini.construeixPeticio: format de la petició', () => {
  const p = g.Gemini.construeixPeticio('model-x', { sistema: 'S', entrada: 'E' });
  assert.equal(p.model, 'model-x');
  assert.equal(p.system_instruction, 'S');
  assert.equal(p.input, 'E');
  assert.equal(p.store, false);
  assert.deepEqual(Array.from(p.response_format.schema.required), ['salutacio', 'paragrafs', 'comiat', 'finalitzada']);
  assert.ok(p.generation_config.max_output_tokens > 0);
});

test('Indicacions: anonimitza adreces i retalla historial llarg', () => {
  assert.equal(g.Indicacions.anonimitza('Escriu a a@b.cat'), 'Escriu a [adreça electrònica]');
  const escenari = g.ESCENARI_INICIAL;
  const historial = Array.from({ length: 30 }, (_, i) => ({ rol: 'participant', contingut: String(i).padEnd(1500, '.') }));
  const entrada = g.Indicacions.construeixEntrada(escenari, historial, [{ contingut: 'nou' }]);
  assert.match(entrada, /S'han omès \d+ missatges antics/);
});

test('Registre: emmascara correus i claus', () => {
  assert.equal(g.Registre.sanititza('docent@centre.cat AIzaSyA1234567890abcdefghijk'), 'd***@centre.cat [clau-ocultada]');
});
