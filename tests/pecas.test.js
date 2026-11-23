import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PECAS, peca } from '../js/pecas.js';

test('toda peça tem nome, texto e grupo em português', () => {
  for (const [id, p] of Object.entries(PECAS)) {
    assert.ok(p.nome?.length > 2, `${id} sem nome`);
    assert.ok(p.texto?.length > 20, `${id} sem texto`);
    assert.ok(['Primeiro estágio', 'Segundo estágio', 'Base de lançamento'].includes(p.grupo), `${id} com grupo inválido`);
  }
});

test('o foguete descreve as peças pedidas no projeto', () => {
  for (const id of ['motores', 'aletas', 'pernas', 'juntas', 'paineis', 'parafusos', 'carenagem', 'plataforma']) {
    assert.ok(PECAS[id], `falta ${id}`);
  }
});

test('peca() devolve null para id desconhecido', () => {
  assert.equal(peca('nao-existe'), null);
  assert.equal(peca('motores').nome, PECAS.motores.nome);
});
