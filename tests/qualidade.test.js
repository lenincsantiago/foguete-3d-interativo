import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escolherQualidade } from '../js/qualidade.js';

test('computador com tela grande recebe qualidade alta', () => {
  const q = escolherQualidade({ largura: 1440, pixelRatio: 2, toque: false, nucleos: 8 });
  assert.equal(q.nivel, 'alta');
  assert.equal(q.sombra, 2048);
  assert.equal(q.pixelRatio, 2);
});

test('celular recebe qualidade baixa e pixel ratio limitado a 1.5', () => {
  const q = escolherQualidade({ largura: 390, pixelRatio: 3, toque: true, nucleos: 8 });
  assert.equal(q.nivel, 'baixa');
  assert.equal(q.pixelRatio, 1.5);
  assert.ok(q.particulas < escolherQualidade({ largura: 1440, pixelRatio: 1, toque: false, nucleos: 8 }).particulas);
});

test('tablet ou máquina fraca recebe qualidade média', () => {
  assert.equal(escolherQualidade({ largura: 820, pixelRatio: 2, toque: true, nucleos: 8 }).nivel, 'media');
  assert.equal(escolherQualidade({ largura: 1440, pixelRatio: 1, toque: false, nucleos: 2 }).nivel, 'media');
});

test('pixel ratio nunca passa de 2', () => {
  assert.equal(escolherQualidade({ largura: 2560, pixelRatio: 4, toque: false, nucleos: 16 }).pixelRatio, 2);
});

test('dados ausentes não quebram: cai em média', () => {
  assert.equal(escolherQualidade({}).nivel, 'media');
});
