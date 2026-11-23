// Ponto de entrada: renderer, cena, câmera e o laço de animação.
// Escala: 1 unidade = 10 metros (o foguete tem ~7 unidades de altura).
import * as THREE from 'three';
import { qualidadeDoAparelho } from './qualidade.js';
import { criarFoguete, liberar } from './foguete.js';
import { criarBase, BASE_FOGUETE } from './plataforma.js';
import { criarAmbiente } from './ambiente.js';
import { criarEfeitos } from './efeitos.js';
import { criarInteracao } from './interacao.js';
import { criarLancamento } from './lancamento.js';

const qualidade = qualidadeDoAparelho();
const canvas = document.getElementById('cena');
const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)');

if (!document.createElement('canvas').getContext('webgl2')) throw new Error('sem-webgl');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(qualidade.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(9, 4.5, 12);
camera.lookAt(0, 3.5, 0);

const ambiente = criarAmbiente(renderer, scene, qualidade);

const base = criarBase(qualidade);
scene.add(base.grupo);

const foguete = criarFoguete();
foguete.grupo.position.y = BASE_FOGUETE;
scene.add(foguete.grupo);

const efeitos = criarEfeitos({ renderer, scene, camera, foguete, qualidade });

// Sombras só são redesenhadas quando algo se mexe (o lançamento liga e desliga isto)
function sombrasAoVivo(ligadas) {
  renderer.shadowMap.autoUpdate = ligadas;
  renderer.shadowMap.needsUpdate = true;
}
sombrasAoVivo(false);
efeitos.definirReduzido(movimentoReduzido.matches);
movimentoReduzido.addEventListener('change', (e) => efeitos.definirReduzido(e.matches));

const reduzido = () => movimentoReduzido.matches;
const interacao = criarInteracao({ camera, renderer, scene, reduzido });
const lancamento = criarLancamento({ foguete, base, efeitos, interacao, ambiente, sombrasAoVivo, reduzido });

// Ordem importa: o estado do voo primeiro, depois a câmera que o segue
const atualizadores = [(d) => lancamento.atualizar(d), (d, t) => interacao.atualizar(d, t)];

const timer = new THREE.Timer();
timer.connect(document);
await efeitos.precompilar();
lancamento.pronto();

// Resolução adaptativa: compara o FPS com a taxa da própria tela (a melhor medida até agora),
// não com 60 fixo — assim telas de 30/50/120 Hz não ficam presas no mínimo. Espera 3 s entre
// mudanças para não realocar os buffers o tempo todo.
const escala = { atual: 1, minimo: 0.6, quadros: 0, soma: 0, tela: 0, espera: 0 };
function ajustarResolucao(deltaReal) {
  escala.quadros++;
  escala.soma += deltaReal;
  if (escala.soma < 1) return;
  const fps = escala.quadros / escala.soma;
  escala.quadros = escala.soma = 0;
  escala.tela = Math.max(escala.tela * 0.98, fps); // estimativa da taxa da tela (decai devagar)
  if (escala.espera > 0) { escala.espera--; return; }
  const alvo = Math.min(escala.tela, 60); // 120 Hz não precisa de 110 FPS; 50 Hz não chega a 55
  let nova = escala.atual;
  if (fps < alvo * 0.92 && escala.atual > escala.minimo) nova = Math.max(escala.minimo, escala.atual - 0.1);
  else if (fps > alvo * 0.98 && escala.atual < 1) nova = Math.min(1, escala.atual + 0.05);
  if (nova === escala.atual) return;
  escala.espera = 3;
  escala.atual = nova;
  renderer.setPixelRatio(qualidade.pixelRatio * nova);
  redimensionar();
}

function quadro() {
  timer.update();
  const deltaReal = timer.getDelta();
  const delta = Math.min(deltaReal, 0.1); // evita saltos depois de travadas
  const tempo = timer.getElapsed();
  for (const fn of atualizadores) fn(delta, tempo);
  efeitos.atualizar(delta);
  efeitos.render();
  if (deltaReal < 0.5) ajustarResolucao(deltaReal); // ignora a volta de uma aba escondida
}
renderer.setAnimationLoop(quadro);

function redimensionar() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  efeitos.redimensionar(w, h);
}
window.addEventListener('resize', redimensionar);

// Aba oculta: para o laço inteiro (economiza bateria); volta ao reaparecer
document.addEventListener('visibilitychange', () => {
  renderer.setAnimationLoop(document.hidden ? null : quadro);
});

// Ao sair da página, devolve a memória da GPU
window.addEventListener('pagehide', (ev) => {
  // Se a página vai para o cache do botão "voltar" (persisted), não libera nada: ela volta inteira
  if (ev.persisted) return;
  renderer.setAnimationLoop(null);
  efeitos.liberar();
  liberar(scene);
  ambiente.ambienteTex.dispose();
  renderer.dispose();
});

// Exposto só para medição nos testes (renderer.info, câmera)
window.__vetor = { THREE, renderer, scene, camera, qualidade, atualizadores, foguete, base, ambiente, efeitos, sombrasAoVivo, interacao, lancamento, escala };
