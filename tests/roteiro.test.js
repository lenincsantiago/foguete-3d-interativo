import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T, FASES, faseEm, contagemEm, formatarAltitude, formatarVelocidade } from '../js/roteiro.js';

test('as fases vêm na ordem do voo e os tempos só crescem', () => {
  assert.deepEqual(FASES, ['contagem', 'ignicao', 'decolagem', 'meco', 'separacao', 'pouso']);
  const tempos = FASES.map((f) => T[f]);
  for (let i = 1; i < tempos.length; i++) assert.ok(tempos[i] > tempos[i - 1]);
  assert.ok(T.fim > T.pouso);
});

test('faseEm devolve a fase certa em cada instante', () => {
  assert.equal(faseEm(0), 'contagem');
  assert.equal(faseEm(T.ignicao - 0.01), 'contagem');
  assert.equal(faseEm(T.ignicao), 'ignicao');
  assert.equal(faseEm(T.decolagem + 1), 'decolagem');
  assert.equal(faseEm(T.separacao + 0.5), 'separacao');
  assert.equal(faseEm(T.fim), 'fim');
  assert.equal(faseEm(-1), null);
});

test('contagem regressiva mostra T−5 até T−1 e some na ignição', () => {
  assert.equal(contagemEm(0), 'T−5');
  assert.equal(contagemEm(0.5), 'T−5');
  assert.equal(contagemEm(4.2), 'T−1');
  assert.equal(contagemEm(T.ignicao), null);
});

test('altitude e velocidade em português, sem números negativos', () => {
  assert.equal(formatarAltitude(0), '0,0 km');
  assert.equal(formatarAltitude(100), '52,0 km');
  assert.equal(formatarAltitude(-0.2), '0,0 km');
  assert.equal(formatarVelocidade(16), '8.320 km/h');
  assert.equal(formatarVelocidade(-2), '1.040 km/h');
});
