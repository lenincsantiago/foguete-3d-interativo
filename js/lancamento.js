// Sequência completa do voo numa única linha do tempo GSAP (pausável e reiniciável).
// A linha do tempo só muda números num objeto de estado; a cada quadro esses números viram cena.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { T, FASES, faseEm, contagemEm, formatarAltitude, formatarVelocidade } from './roteiro.js';
import { TOPO_INTER, ALTURA_PES } from './foguete.js';
import { BASE_FOGUETE, ZONA_POUSO } from './plataforma.js';

const $ = (id) => document.getElementById(id);
const NOMES = { contagem: 'Contagem', ignicao: 'Ignição', decolagem: 'Decolagem', meco: 'Corte dos motores', separacao: 'Separação dos estágios', pouso: 'Queima de pouso', fim: 'Pouso concluído' };

export function criarLancamento({ foguete, base, efeitos, interacao, ambiente, sombrasAoVivo, reduzido }) {
  const ALTURA_POUSADO = ZONA_POUSO.y + ALTURA_PES - BASE_FOGUETE; // y local do estágio 1 com os pés na zona

  const INICIAL = { y1: 0, x1: 0, z1: 0, inclina: 0, y2: 0, pot1: 0, pot2: 0, aletas: 0, pernas: 0, braco: 0, tremor: 0 };
  const s = { ...INICIAL };
  const eixoInclina = new THREE.Vector3(ZONA_POUSO.z, 0, -ZONA_POUSO.x).normalize(); // inclina na direção da zona

  const tl = gsap.timeline({ paused: true, onComplete: terminou });
  tl.addLabel('contagem', T.contagem)
    .to(s, { braco: 1, duration: 2, ease: 'power2.inOut' }, 1)
    // Ignição: motores sobem até força total enquanto as garras seguram
    .addLabel('ignicao', T.ignicao)
    .to(s, { pot1: 1, duration: 1.2, ease: 'power2.out' }, 'ignicao')
    .to(s, { tremor: 1, duration: 0.6, ease: 'power1.out' }, 'ignicao')
    // Decolagem: acelera até o corte (MECO)
    .addLabel('decolagem', T.decolagem)
    .to(s, { y1: 110, y2: 110, duration: T.meco - T.decolagem, ease: 'power2.in' }, 'decolagem')
    .to(s, { tremor: 0, duration: 5, ease: 'power1.in' }, 'decolagem')
    .addLabel('meco', T.meco)
    .to(s, { pot1: 0, duration: 0.3, ease: 'power1.in' }, 'meco')
    .to(s, { y1: 122, y2: 122, duration: T.separacao - T.meco, ease: 'power1.out' }, 'meco')
    // Separação: o segundo estágio se afasta e acende; o primeiro abre as aletas e manobra de volta
    .addLabel('separacao', T.separacao)
    .to(s, { y2: 300, duration: 11, ease: 'power2.in' }, 'separacao')
    .to(s, { pot2: 1, duration: 0.6, ease: 'power2.out' }, T.separacao + 1.5)
    .to(s, { pot2: 0, duration: 0.5, ease: 'power1.in' }, T.separacao + 10.5) // já fora do quadro: desliga e o brilho para de ser calculado
    .to(s, { y1: 128, duration: 2, ease: 'power1.out' }, 'separacao')
    .to(s, { aletas: 1, duration: 1, ease: 'power2.out' }, T.separacao + 1.5)
    .to(s, { inclina: -0.35, duration: 2.5, ease: 'power1.inOut' }, T.separacao + 1)
    .to(s, { x1: ZONA_POUSO.x, z1: ZONA_POUSO.z, duration: T.pouso + 5 - (T.separacao + 2), ease: 'power1.inOut' }, T.separacao + 2)
    .to(s, { y1: 40, duration: T.pouso - (T.separacao + 2), ease: 'power2.in' }, T.separacao + 2)
    .to(s, { inclina: 0, duration: 2, ease: 'power1.inOut' }, T.pouso - 3)
    // Queima de pouso: freia, abre as pernas e toca o chão
    .addLabel('pouso', T.pouso)
    .to(s, { pot1: 0.75, duration: 0.5, ease: 'power2.out' }, 'pouso')
    .to(s, { y1: ALTURA_POUSADO, duration: 6.5, ease: 'power3.out' }, 'pouso')
    .to(s, { pernas: 1, duration: 1.3, ease: 'power2.inOut' }, T.pouso + 3.5)
    .to(s, { pot1: 0, duration: 0.4, ease: 'power1.in' }, T.pouso + 6.4)
    .to({}, { duration: T.fim - (T.pouso + 6.8) }); // respiro antes de "fim"

  // Enquadramentos da câmera. Com movimento reduzido: cortes secos e câmera parada entre eles.
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const CORTES = [
    [T.decolagem + 3, V(30, 12, 48), V(0, 22, 0)],
    // distâncias abaixo de controls.maxDistance (60), senão o OrbitControls puxa a câmera de volta
    [T.decolagem + 9, V(30, 62, 46), V(0, 70, 0)],
    [T.meco, V(26, 118, 34), V(0, 124, 0)],
    [T.separacao + 4, V(40, 72, 40), V(12, 75, -8)],
    [T.pouso, V(ZONA_POUSO.x + 10, 8, ZONA_POUSO.z + 16), V(ZONA_POUSO.x, 4, ZONA_POUSO.z)],
  ];
  for (const [t, pos, alvo] of CORTES) tl.call(() => { if (reduzido()) interacao.enquadrar(pos, alvo, 0); }, null, t);
  tl.call(() => { if (!reduzido()) interacao.seguir(foguete.estagio1); }, null, T.decolagem);
  // Antes do pouso a câmera para de seguir e espera o estágio na zona (pernas e chão no quadro)
  tl.call(() => {
    interacao.seguir(null);
    if (!reduzido()) interacao.enquadrar(V(ZONA_POUSO.x + 9, 5, ZONA_POUSO.z + 14), V(ZONA_POUSO.x, 3, ZONA_POUSO.z), 2.5);
  }, null, T.pouso - 1.5);

  // ---------- Aplica o estado na cena (a cada quadro) ----------
  const q = new THREE.Quaternion();
  const chaoSob = new THREE.Vector3();
  let yAnterior = 0;
  let tAnterior = 0;
  let velocidade = 0;

  function aplicar(delta) {
    foguete.estagio1.position.set(s.x1, s.y1, s.z1);
    foguete.estagio1.quaternion.copy(q.setFromAxisAngle(eixoInclina, s.inclina));
    foguete.estagio2.position.set(0, TOPO_INTER + s.y2, 0);
    foguete.abrirAletas(s.aletas);
    foguete.abrirPernas(s.pernas);
    base.recolherBraco(s.braco);
    efeitos.definirPotencia(1, s.pot1);
    efeitos.definirPotencia(2, s.pot2);
    const pausado = tl.paused();
    efeitos.definirPausa(pausado); // na pausa a fumaça, a chama e o calor congelam junto com o voo
    interacao.tremor(pausado ? 0 : s.tremor);
    // Velocidade medida no tempo do voo: na pausa o número congela em vez de cair a zero
    const t = tl.time();
    const dt = t - tAnterior;
    if (dt > 0 && dt < 0.5) {
      const v = (s.y1 - yAnterior) / dt;
      velocidade += (v - velocidade) * Math.min(1, dt * 6); // suaviza o número mostrado
    }
    yAnterior = s.y1;
    tAnterior = t;
    efeitos.definirFumacaSolo(t > T.separacao ? 0.35 : 1); // queima de pouso levanta menos poeira
    chaoSob.set(s.x1, 0, s.z1);
    ambiente.focarSombra(chaoSob);
  }

  // ---------- Interface ----------
  const btn = $('lancar');
  const btnReiniciar = $('reiniciar');
  const contagem = $('contagem');
  const status = $('status');
  const itensFase = [...document.querySelectorAll('#fases li')];
  const altitude = $('altitude');
  const vel = $('velocidade');
  let faseMostrada = null;
  let textoAlt = '';
  let textoVel = '';
  let textoContagem = null;

  function atualizarInterface() {
    const t = tl.time();
    const iniciado = t > 0 || !tl.paused();
    const fase = iniciado ? faseEm(t) : null;
    if (fase !== faseMostrada) {
      faseMostrada = fase;
      const i = fase === 'fim' ? FASES.length : FASES.indexOf(fase);
      itensFase.forEach((li, j) => {
        li.classList.toggle('feita', j < i);
        li.classList.toggle('atual', j === i);
        if (j === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      if (fase) status.textContent = NOMES[fase];
    }
    const c = iniciado ? contagemEm(t) : null;
    if (c !== textoContagem) {
      textoContagem = c;
      if (c) contagem.textContent = c;
      contagem.classList.toggle('visivel', Boolean(c));
    }
    const a = formatarAltitude(s.y1 - ALTURA_POUSADO * (t > T.pouso ? 1 : 0));
    const v = formatarVelocidade(velocidade);
    if (a !== textoAlt) altitude.textContent = textoAlt = a; // só escreve no DOM quando muda
    if (v !== textoVel) vel.textContent = textoVel = v;
    rotuloBotao();
  }

  let rotuloAtual = '';
  function rotuloBotao() {
    let r = 'Lançar';
    if (tl.progress() === 1) r = 'Lançar de novo';
    else if (!tl.paused()) r = 'Pausar';
    else if (tl.time() > 0) r = 'Continuar';
    if (r !== rotuloAtual) btn.textContent = rotuloAtual = r; // DOM só muda quando o estado muda
    const esconder = tl.time() === 0 && tl.paused();
    if (btnReiniciar.hidden !== esconder) btnReiniciar.hidden = esconder;
  }

  function lancar() {
    if (tl.progress() === 1) reiniciar(false);
    if (!tl.paused()) {
      tl.pause();
      sombrasAoVivo(false);
    } else {
      if (tl.time() === 0) {
        interacao.fecharPainel();
        interacao.enquadrar(V(7, 3.2, 9.5), V(0, 3.2, 0), 1.4);
      }
      tl.play();
      sombrasAoVivo(true);
    }
    rotuloBotao();
  }

  function reiniciar(enquadrarInicio = true) {
    tl.pause(0);
    interacao.seguir(null);
    Object.assign(s, INICIAL);
    aplicar(0);
    velocidade = 0;
    tAnterior = 0;
    efeitos.limparFumaca();
    sombrasAoVivo(false);
    if (enquadrarInicio) interacao.enquadrar(V(9, 4.5, 12), V(0, 3.5, 0), 1);
    status.textContent = enquadrarInicio ? 'Foguete de volta à plataforma' : '';
    rotuloBotao();
  }

  function terminou() {
    sombrasAoVivo(false);
    interacao.seguir(null);
    rotuloBotao();
    btn.focus({ preventScroll: true });
  }

  btn.addEventListener('click', lancar);

  // Aba oculta: pausa o voo de verdade (não só o desenho) e retoma ao voltar
  let retomarAoVoltar = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !tl.paused()) { tl.pause(); retomarAoVoltar = true; }
    else if (!document.hidden && retomarAoVoltar) { tl.play(); retomarAoVoltar = false; }
  });
  btnReiniciar.addEventListener('click', () => reiniciar());
  interacao.acoesTeclado.l = lancar;
  interacao.acoesTeclado.r = () => reiniciar();

  return {
    timeline: tl,
    atualizar(delta) {
      aplicar(delta);
      atualizarInterface();
    },
    reiniciar,
    // Chamado pelo main depois de compilar os shaders: só então o botão funciona
    pronto() { btn.disabled = false; },
  };
}
