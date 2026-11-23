// Câmera (girar, zoom, seguir), clique nas peças, painel de informação, lista de peças e teclado.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';
import { PECAS, peca } from './pecas.js';

const $ = (id) => document.getElementById(id);

export function criarInteracao({ camera, renderer, scene, reduzido }) {
  const canvas = renderer.domElement;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; // não deixa a câmera ir para baixo do chão
  controls.target.set(0, 3.5, 0);
  controls.update();

  // ---------- Seguir um objeto (a câmera anda junto, o usuário continua girando) ----------
  let seguido = null;
  const ultimo = new THREE.Vector3();
  const atual = new THREE.Vector3();
  const passo = new THREE.Vector3();
  function seguir(obj) {
    seguido = obj;
    if (obj) obj.getWorldPosition(ultimo);
  }

  // ---------- Tremor da câmera (decolagem); somado depois do update, retirado no quadro seguinte ----------
  let forcaTremor = 0;
  const tremorAtual = new THREE.Vector3();

  function atualizar(delta, tempo) {
    camera.position.sub(tremorAtual);
    tremorAtual.set(0, 0, 0);
    if (seguido) {
      seguido.getWorldPosition(atual);
      passo.subVectors(atual, ultimo);
      camera.position.add(passo);
      controls.target.add(passo);
      ultimo.copy(atual);
    }
    controls.update(delta);
    if (forcaTremor > 0 && !reduzido()) {
      tremorAtual.set(Math.sin(tempo * 61) * 0.6, Math.sin(tempo * 47 + 1) * 0.6, Math.sin(tempo * 53 + 2) * 0.6).multiplyScalar(forcaTremor * 0.04);
      camera.position.add(tremorAtual);
    }
    posicionarMarcador();
  }

  // Move câmera e alvo juntos para um enquadramento (instantâneo se o movimento estiver reduzido)
  function enquadrar(posicao, alvo, duracao = 1.2) {
    gsap.killTweensOf([camera.position, controls.target]);
    camera.position.sub(tremorAtual); // tira o tremor antes de reposicionar, senão sobra uma deriva
    tremorAtual.set(0, 0, 0);
    if (reduzido() || duracao === 0) {
      camera.position.copy(posicao);
      controls.target.copy(alvo);
      return;
    }
    gsap.to(camera.position, { x: posicao.x, y: posicao.y, z: posicao.z, duration: duracao, ease: 'power2.inOut' });
    gsap.to(controls.target, { x: alvo.x, y: alvo.y, z: alvo.z, duration: duracao, ease: 'power2.inOut' });
  }

  // ---------- Peças clicáveis (camada 1) ----------
  const raycaster = new THREE.Raycaster();
  raycaster.layers.set(1);
  const ponteiro = new THREE.Vector2();
  let clicaveis = [];
  function atualizarClicaveis() {
    clicaveis = [];
    scene.traverse((o) => { if (o.userData.peca) clicaveis.push(o); });
  }
  atualizarClicaveis();

  function acertar(ev) {
    const r = canvas.getBoundingClientRect();
    ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ponteiro, camera);
    return raycaster.intersectObjects(clicaveis, false).find((h) => h.object.visible) ?? null;
  }

  // ---------- Painel e marcador ----------
  const painel = $('painel');
  const marcador = $('marcador');
  const pontoMarcado = new THREE.Vector3();
  const objMarcado = { obj: null, local: new THREE.Vector3() };
  const tela = new THREE.Vector3();
  let largura = window.innerWidth;
  let altura = window.innerHeight;
  window.addEventListener('resize', () => { largura = window.innerWidth; altura = window.innerHeight; });
  let marcadorFora = null;

  function mostrarPeca(id, obj, pontoMundo) {
    const p = peca(id);
    if (!p) return;
    $('painel-titulo').textContent = p.nome;
    $('painel-texto').textContent = p.texto;
    $('painel-grupo').textContent = p.grupo;
    painel.hidden = false;
    // guarda o ponto no espaço do objeto: o marcador acompanha a peça mesmo em voo
    objMarcado.obj = obj;
    objMarcado.local.copy(obj.worldToLocal(pontoMundo.clone()));
    marcador.classList.add('visivel');
    $('status').textContent = `${p.nome}: ${p.texto}`;
  }

  function fecharPainel() {
    if (painel.hidden) return;
    painel.hidden = true;
    objMarcado.obj = null;
    marcador.classList.remove('visivel');
  }

  function posicionarMarcador() {
    if (!objMarcado.obj) return;
    pontoMarcado.copy(objMarcado.local);
    objMarcado.obj.localToWorld(pontoMarcado);
    tela.copy(pontoMarcado).project(camera);
    const fora = tela.z > 1 || Math.abs(tela.x) > 1 || Math.abs(tela.y) > 1;
    const x = ((tela.x + 1) / 2) * largura; // tamanhos guardados: nenhuma leitura de layout por quadro
    const y = ((1 - tela.y) / 2) * altura;
    marcador.style.transform = `translate3d(${x}px, ${y}px, 0)`; // só transform: não força layout
    if (fora !== marcadorFora) marcador.style.opacity = (marcadorFora = fora) ? '0' : '';
  }

  $('painel-fechar').addEventListener('click', () => { fecharPainel(); canvas.focus(); });

  // Clique = apertar e soltar sem arrastar (arrasto gira a câmera)
  let inicio = null;
  canvas.addEventListener('pointerdown', (ev) => {
    inicio = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    esconderDica();
  });
  canvas.addEventListener('pointerup', (ev) => {
    if (!inicio) return;
    const moveu = Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y);
    const rapido = performance.now() - inicio.t < 500;
    inicio = null;
    if (moveu > 6 || !rapido) return;
    const hit = acertar(ev);
    if (hit) mostrarPeca(hit.object.userData.peca, hit.object, hit.point);
    else fecharPainel();
  });

  // Cursor de "mão" sobre peças (só com mouse; checagem no máximo 1 vez por quadro)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let pendente = null;
    canvas.addEventListener('pointermove', (ev) => {
      if (ev.buttons) return;
      if (!pendente) requestAnimationFrame(() => {
        canvas.style.cursor = acertar(pendente) ? 'pointer' : '';
        pendente = null;
      });
      pendente = ev;
    });
  }

  // ---------- Lista de peças (acesso por teclado e alternativa em texto) ----------
  const btnPecas = $('btn-pecas');
  const lista = $('lista-pecas');
  const itens = $('lista-pecas-itens');
  for (const [id, p] of Object.entries(PECAS)) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.peca = id;
    b.setAttribute('aria-label', `${p.nome}, ${p.grupo.toLowerCase()}`); // leitor de tela: "Carenagem, segundo estágio"
    b.innerHTML = `<span class="lp-nome"></span><span class="lp-grupo"></span>`;
    b.querySelector('.lp-nome').textContent = p.nome;
    b.querySelector('.lp-grupo').textContent = p.grupo;
    li.append(b);
    itens.append(li);
  }
  const caixa = new THREE.Box3();
  const centro = new THREE.Vector3();
  itens.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-peca]');
    if (!b) return;
    const id = b.dataset.peca;
    const obj = clicaveis.find((o) => o.userData.peca === id && o.visible);
    abrirLista(false);
    if (!obj) return;
    caixa.setFromObject(obj).getCenter(centro);
    mostrarPeca(id, obj, centro);
    if (!seguido) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      const dist = THREE.MathUtils.clamp(caixa.getSize(new THREE.Vector3()).length() * 2.2, 3, 30);
      enquadrar(centro.clone().addScaledVector(dir, dist), centro, 0.8);
    }
    $('painel-fechar').focus();
  });
  function abrirLista(abrir) {
    lista.hidden = !abrir;
    btnPecas.setAttribute('aria-expanded', String(abrir));
    if (abrir) itens.querySelector('button')?.focus();
  }
  btnPecas.addEventListener('click', () => abrirLista(lista.hidden));
  lista.addEventListener('keydown', (ev) => {
    const botoes = [...itens.querySelectorAll('button')];
    const i = botoes.indexOf(document.activeElement);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); botoes[(i + 1) % botoes.length].focus(); }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); botoes[(i - 1 + botoes.length) % botoes.length].focus(); }
    if (ev.key === 'Escape') { abrirLista(false); btnPecas.focus(); }
  });
  document.addEventListener('pointerdown', (ev) => {
    if (!lista.hidden && !lista.contains(ev.target) && ev.target !== btnPecas) abrirLista(false);
  });

  // ---------- Teclado na cena ----------
  const esf = new THREE.Spherical();
  const offset = new THREE.Vector3();
  function orbitar(dAz, dPol, fZoom = 1) {
    offset.copy(camera.position).sub(controls.target);
    esf.setFromVector3(offset);
    esf.theta += dAz;
    esf.phi = THREE.MathUtils.clamp(esf.phi + dPol, 0.1, controls.maxPolarAngle);
    esf.radius = THREE.MathUtils.clamp(esf.radius * fZoom, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setFromSpherical(esf));
  }
  const acoesTeclado = {}; // preenchido pelo lançamento (L e R)
  canvas.addEventListener('keydown', (ev) => {
    const k = ev.key;
    if (k === 'ArrowLeft') orbitar(-0.12, 0);
    else if (k === 'ArrowRight') orbitar(0.12, 0);
    else if (k === 'ArrowUp') orbitar(0, -0.08);
    else if (k === 'ArrowDown') orbitar(0, 0.08);
    else if (k === '+' || k === '=') orbitar(0, 0, 0.88);
    else if (k === '-' || k === '_') orbitar(0, 0, 1.14);
    else return;
    ev.preventDefault();
    esconderDica();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.target.closest?.('input, textarea')) return;
    if (ev.key === 'Escape') { fecharPainel(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const fn = acoesTeclado[ev.key.toLowerCase()];
    if (fn && (ev.target === canvas || ev.target === document.body)) { ev.preventDefault(); fn(); }
  });

  // ---------- Dica inicial ----------
  const dica = $('dica');
  if (matchMedia('(pointer: coarse)').matches) {
    dica.textContent = 'Arraste para girar. Use dois dedos para aproximar. Toque numa peça para saber o que ela faz.';
  }
  const textoDicaTeclado = 'Setas giram a câmera. Mais e menos aproximam. L lança.';
  let dicaTimer = setTimeout(esconderDica, 9000);
  function esconderDica() {
    clearTimeout(dicaTimer);
    dica.classList.add('sumiu');
  }
  canvas.addEventListener('focus', () => {
    if (!canvas.matches(':focus-visible')) return;
    dica.textContent = textoDicaTeclado;
    dica.classList.remove('sumiu');
    clearTimeout(dicaTimer);
    dicaTimer = setTimeout(esconderDica, 6000);
  });

  return {
    controls,
    atualizar,
    enquadrar,
    seguir,
    tremor(f) { forcaTremor = f; },
    fecharPainel,
    atualizarClicaveis,
    acoesTeclado,
  };
}
