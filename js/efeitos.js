// Chama (shader), fumaça (partículas), ondas de calor e brilho seletivo (bloom só no que é quente).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';

export const CAMADA_BRILHO = 2;

const RUIDO = /* glsl */ `
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float ruido(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 3; i++) { v += a * ruido(p); p *= 2.03; a *= 0.5; } return v / 0.875; }
`;

// Jato de chama: cilindro aberto deformado no vertex shader, ruído animado no fragment shader
// tempo e tremor são objetos compartilhados por todas as chamas: um só valor atualizado por quadro
const uTempo = { value: 0 };
const uTremor = { value: 1 };

function materialChama({ quente, meio, ponta, intensidade, raioBase = 0.18, raioFim = 0.45, comprimento = 2.4 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tempo: uTempo,
      potencia: { value: 0 },
      tremor: uTremor,
      raioBase: { value: raioBase },
      raioFim: { value: raioFim },
      comprimento: { value: comprimento },
      intensidade: { value: intensidade },
      corQuente: { value: new THREE.Color(quente) },
      corMeio: { value: new THREE.Color(meio) },
      corPonta: { value: new THREE.Color(ponta) },
    },
    vertexShader: /* glsl */ `
      uniform float tempo; uniform float tremor; uniform float raioBase; uniform float raioFim; uniform float comprimento;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        float t = 1.0 - uv.y; // 0 no bocal, 1 na ponta
        float pulso = 1.0 + tremor * 0.06 * sin(tempo * 47.0 + t * 9.0) * t;
        vec3 p = position;
        p.xz *= mix(raioBase, raioFim, pow(t, 0.55)) * pulso;
        p.y *= comprimento * (1.0 + tremor * 0.05 * sin(tempo * 31.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float tempo; uniform float potencia; uniform float intensidade;
      uniform vec3 corQuente; uniform vec3 corMeio; uniform vec3 corPonta;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      ${RUIDO}
      void main() {
        float t = 1.0 - vUv.y;
        float n = fbm(vec3(vUv.x * 7.0, t * 5.0 - tempo * 9.0, tempo * 0.8));
        float corpo = pow(1.0 - t, 1.4);
        float borda = pow(abs(dot(normalize(vN), normalize(vV))), 1.3);
        float a = clamp(corpo * borda * (0.45 + 0.9 * n) * potencia, 0.0, 1.0);
        vec3 c = mix(corQuente, corMeio, smoothstep(0.0, 0.3, t));
        c = mix(c, corPonta, smoothstep(0.3, 1.0, t));
        gl_FragColor = vec4(c * intensidade, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending, // só a face da frente: metade dos pixels, mesma aparência
  });
}

function criarJato(opcoes, nucleo) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 32, 20, true).translate(0, -0.5, 0);
  const grupo = new THREE.Group();
  const fora = new THREE.Mesh(geo, materialChama(opcoes));
  const dentro = new THREE.Mesh(geo, materialChama(nucleo));
  for (const m of [fora, dentro]) {
    m.frustumCulled = false; // o shader muda o tamanho; a esfera de corte não sabe disso
    m.layers.enable(CAMADA_BRILHO);
    grupo.add(m);
  }
  grupo.visible = false;
  return { grupo, fora, dentro };
}

// Fumaça: um único Points com atributos por partícula, atualizado na CPU
function criarFumaca(max) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const vida = new Float32Array(max).fill(1);
  const tam = new Float32Array(max);
  const calor = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aVida', new THREE.BufferAttribute(vida, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aTam', new THREE.BufferAttribute(tam, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aCalor', new THREE.BufferAttribute(calor, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      escalaPx: { value: 400 },
      corFumaca: { value: new THREE.Color(0x8a909a) },
      corLuz: { value: new THREE.Color(0xff8a3d) },
    },
    vertexShader: /* glsl */ `
      attribute float aVida; attribute float aTam; attribute float aCalor;
      uniform float escalaPx; varying float vVida; varying float vCalor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aVida >= 1.0 ? 0.0 : min(aTam * escalaPx / -mv.z, 280.0); // teto: partícula gigante na frente da câmera custa caro
        vVida = aVida; vCalor = aCalor;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 corFumaca; uniform vec3 corLuz;
      varying float vVida; varying float vCalor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float macio = 1.0 - d * d;
        float lado = 0.7 + 0.3 * (1.0 - gl_PointCoord.y);
        float a = macio * smoothstep(0.0, 0.06, vVida) * (1.0 - smoothstep(0.5, 1.0, vVida)) * 0.5;
        vec3 c = corFumaca * lado + corLuz * vCalor * pow(1.0 - vVida, 4.0) * 1.2;
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const pontos = new THREE.Points(geo, mat);
  pontos.frustumCulled = false;
  const estado = {
    pos, vida, tam, calor,
    vel: new Float32Array(max * 3),
    idade: new Float32Array(max),
    duracao: new Float32Array(max).fill(1),
    tam0: new Float32Array(max),
    proxima: 0,
    vivas: 0,
  };
  return { pontos, geo, mat, estado, max };
}

export function criarEfeitos({ renderer, scene, camera, foguete, qualidade }) {
  let reduzido = false;
  let pausado = false;
  let tempoEfeito = 0; // relógio dos efeitos: para junto com o voo pausado

  // ---------- Jatos ----------
  const jato1 = criarJato(
    { quente: 0xfff1d0, meio: 0xff9a3a, ponta: 0xff4a12, intensidade: 2.2 },
    { quente: 0xffffff, meio: 0xffe0a0, ponta: 0xffb060, intensidade: 3.2, raioBase: 0.12, raioFim: 0.16, comprimento: 0.9 },
  );
  jato1.grupo.position.set(0, -0.36, 0);
  foguete.estagio1.add(jato1.grupo);

  const jato2 = criarJato(
    { quente: 0xffe6bf, meio: 0xff9a55, ponta: 0x7a5cff, intensidade: 1.6, raioBase: 0.15, raioFim: 0.9, comprimento: 2.2 },
    { quente: 0xffffff, meio: 0xffd2a0, ponta: 0xff9a55, intensidade: 3.0, raioBase: 0.1, raioFim: 0.14, comprimento: 0.5 },
  );
  jato2.grupo.position.copy(foguete.saidaMvac);
  foguete.estagio2.add(jato2.grupo);

  // Luz laranja da chama (sempre existe; intensidade 0 quando apagada, para não recompilar materiais)
  const luzChama = new THREE.PointLight(0xff9a4a, 0, 30, 2);
  scene.add(luzChama);

  // ---------- Fumaça ----------
  const fumaca = criarFumaca(qualidade.particulas);
  scene.add(fumaca.pontos);
  const taxa = qualidade.particulas / 1400;

  function emitir(x, y, z, vx, vy, vz, tamanho, duracao, calor) {
    const e = fumaca.estado;
    const i = e.proxima;
    e.proxima = (i + 1) % fumaca.max;
    e.pos[i * 3] = x; e.pos[i * 3 + 1] = y; e.pos[i * 3 + 2] = z;
    e.vel[i * 3] = vx; e.vel[i * 3 + 1] = vy; e.vel[i * 3 + 2] = vz;
    e.idade[i] = 0;
    e.duracao[i] = duracao;
    e.tam0[i] = tamanho;
    e.calor[i] = calor;
    e.vida[i] = 0;
  }

  // ---------- Pós-processamento ----------
  // Sem MSAA: em GPU integrada ele custava ~20 FPS (medido: 39 → 59). O FXAA no fim suaviza as bordas.
  const alvo = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, alvo);

  // Brilho seletivo com oclusão: 1) a cena inteira em preto só para gravar profundidade;
  // 2) as chamas por cima, testando essa profundidade (assim o brilho não atravessa torre, laje ou corpo)
  const composerBrilho = new EffectComposer(renderer);
  composerBrilho.renderToScreen = false;
  const pretoOclusor = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const passeOclusao = new RenderPass(scene, camera, pretoOclusor);
  composerBrilho.addPass(passeOclusao);
  const camBrilho = camera.clone();
  const passeChamas = new RenderPass(scene, camBrilho);
  passeChamas.clear = false;
  composerBrilho.addPass(passeChamas);
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.5, 0);
  composerBrilho.addPass(bloom);

  composer.addPass(new RenderPass(scene, camera));
  const mistura = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: { baseTexture: { value: null }, bloomTexture: { value: composerBrilho.renderTarget2.texture } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }',
    }),
    'baseTexture',
  );
  composer.addPass(mistura);

  // Ondas de calor: distorce a imagem numa elipse em volta do jato
  const calorPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      centro: { value: new THREE.Vector2(0.5, 0.2) },
      raio: { value: new THREE.Vector2(0.1, 0.2) },
      forca: { value: 0 },
      tempo: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform vec2 centro; uniform vec2 raio; uniform float forca; uniform float tempo;
      varying vec2 vUv;
      void main() {
        vec2 d = (vUv - centro) / raio;
        float m = 1.0 - smoothstep(0.2, 1.0, length(d));
        vec2 off = vec2(sin(vUv.y * 140.0 + tempo * 13.0), cos(vUv.x * 110.0 - tempo * 9.0)) * 0.0025 * forca * m;
        gl_FragColor = texture2D(tDiffuse, vUv + off);
      }
    `,
  });
  composer.addPass(calorPass);
  composer.addPass(new OutputPass());
  composer.addPass(new FXAAPass()); // depois do OutputPass: o FXAA precisa de cor já em sRGB

  function redimensionar(w, h) {
    const pr = renderer.getPixelRatio(); // o composer guarda o pixel ratio da criação; atualiza aqui
    composer.setPixelRatio(pr);
    composerBrilho.setPixelRatio(pr);
    composer.setSize(w, h);
    composerBrilho.setSize(Math.ceil(w / 2), Math.ceil(h / 2)); // brilho é borrado: meia resolução basta
    fumaca.mat.uniforms.escalaPx.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }
  redimensionar(window.innerWidth, window.innerHeight);

  // ---------- Estado e quadro ----------
  const potencia = [0, 0];
  let fumacaSolo = 1;
  const bocal = new THREE.Vector3();
  const ponta = new THREE.Vector3();
  const tela = new THREE.Vector3();
  const tela2 = new THREE.Vector3();
  let acumulado = 0;

  function aplicarPotencia(jato, f) {
    jato.grupo.visible = f > 0.001;
    jato.fora.material.uniforms.potencia.value = f;
    jato.dentro.material.uniforms.potencia.value = f;
  }

  function atualizar(deltaReal) {
    const delta = pausado ? 0 : deltaReal; // pausado: nada emite, nada se move, a chama congela
    tempoEfeito += delta;
    const tempo = tempoEfeito;
    const tremor = reduzido ? 0 : 1;
    uTempo.value = tempo;
    uTremor.value = tremor;
    aplicarPotencia(jato1, potencia[0]);
    aplicarPotencia(jato2, potencia[1]);

    // Jato 1 abre conforme o ar fica rarefeito
    jato1.grupo.getWorldPosition(bocal);
    const altitude = bocal.y;
    const ar = THREE.MathUtils.clamp(altitude / 60, 0, 1);
    jato1.fora.material.uniforms.raioFim.value = 0.42 + ar * 1.1;
    jato1.fora.material.uniforms.comprimento.value = 2.4 + ar * 1.6;

    luzChama.position.set(bocal.x, bocal.y - 0.6, bocal.z);
    luzChama.intensity = potencia[0] * 12 *(1 + tremor * 0.15 * Math.sin(tempo * 53));

    // Emissão de fumaça proporcional à potência; nuvem rasteira perto do chão
    const e = fumaca.estado;
    if (potencia[0] > 0.01) {
      acumulado += delta * potencia[0] * taxa;
      const perto = altitude < (fumacaSolo < 1 ? 3.5 : 7); // no pouso a poeira só sobe bem perto do chão
      const porSeg = perto ? 260 * fumacaSolo : altitude < 120 ? 70 : 0;
      let n = Math.floor(acumulado * porSeg);
      acumulado -= n / Math.max(porSeg, 1);
      while (n-- > 0) {
        if (perto) {
          const a = Math.random() * Math.PI * 2;
          const v = 2.5 + Math.random() * 3.5;
          const dz = fumacaSolo < 1 ? Math.sin(a) * v : Math.abs(Math.sin(a)) * v * 0.9 + 1; // decolagem: sai pela calha; pouso: espalha em roda
          emitir(bocal.x, 0.45 + Math.random() * 0.3, bocal.z + (fumacaSolo < 1 ? 0 : 0.6), Math.cos(a) * v, 0.4 + Math.random() * 1.2, dz,
            (0.9 + Math.random() * 1.1) * (fumacaSolo < 1 ? 0.6 : 1), (6 + Math.random() * 4) * (fumacaSolo < 1 ? 0.6 : 1), 0.5);
        } else {
          emitir(bocal.x + (Math.random() - 0.5) * 0.3, bocal.y - 1.5 - Math.random() * 1.5, bocal.z + (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.6, -1 - Math.random(), (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.6, 4 + Math.random() * 2, 0.6);
        }
      }
    } else {
      acumulado = 0;
    }

    // Física simples: arrasto, empuxo para cima, vento leve, chão que espalha
    let vivas = 0;
    const arrasto = Math.exp(-delta * 0.9);
    for (let i = 0; i < fumaca.max; i++) {
      if (e.vida[i] >= 1) continue;
      e.idade[i] += delta;
      const v = e.idade[i] / e.duracao[i];
      if (v >= 1) { e.vida[i] = 1; continue; }
      vivas++;
      const k = i * 3;
      e.vel[k] = e.vel[k] * arrasto + 0.25 * delta;
      e.vel[k + 1] = e.vel[k + 1] * arrasto + 0.35 * delta;
      e.vel[k + 2] *= arrasto;
      e.pos[k] += e.vel[k] * delta;
      e.pos[k + 1] += e.vel[k + 1] * delta;
      e.pos[k + 2] += e.vel[k + 2] * delta;
      if (e.pos[k + 1] < 0.35) { e.pos[k + 1] = 0.35; e.vel[k + 1] = Math.abs(e.vel[k + 1]) * 0.3; }
      e.vida[i] = v;
      e.tam[i] = e.tam0[i] * (1 + v * 3.5);
    }
    // Só reenvia para a GPU se havia partícula viva (agora ou no quadro anterior, para apagar a última)
    if (vivas > 0 || e.vivas > 0) {
      const g = fumaca.geo.attributes;
      g.position.needsUpdate = g.aVida.needsUpdate = g.aTam.needsUpdate = g.aCalor.needsUpdate = true;
    }
    e.vivas = vivas;

    // Ondas de calor ao redor do jato 1, medidas na tela
    const forcaCalor = reduzido ? 0 : potencia[0];
    calorPass.enabled = forcaCalor > 0; // passe de tela cheia só quando há motor ligado
    calorPass.uniforms.forca.value = forcaCalor;
    calorPass.uniforms.tempo.value = tempo;
    if (forcaCalor > 0) {
      ponta.copy(bocal).y -= 2.0;
      tela.copy(bocal).project(camera);
      tela2.copy(ponta).project(camera);
      // bocal atrás da câmera: a projeção sai espelhada; desliga o efeito
      if (tela.z > 1 || tela2.z > 1) calorPass.enabled = false;
      calorPass.uniforms.centro.value.set((tela.x + tela2.x) * 0.25 + 0.5, (tela.y + tela2.y) * 0.25 + 0.5);
      const alt = Math.max(Math.abs(tela.y - tela2.y) * 0.5, 0.05);
      calorPass.uniforms.raio.value.set((alt * 0.7) / camera.aspect, alt); // aspecto da câmera: sem ler a janela por quadro
    }
  }

  function render() {
    const brilhar = potencia[0] > 0.001 || potencia[1] > 0.001;
    mistura.enabled = brilhar;
    if (brilhar) renderBrilho();
    // 2) Cena completa + brilho + calor + tom final
    composer.render();
  }

  // 1) Só a camada de brilho (chamas), em meia resolução e sem refazer sombras
  function renderBrilho() {
    const autoSombra = renderer.shadowMap.autoUpdate;
    const pedido = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.autoUpdate = false;
    camBrilho.copy(camera);
    camBrilho.layers.set(CAMADA_BRILHO);
    fumaca.pontos.visible = false; // fumaça não oclui o brilho (ela é translúcida)
    composerBrilho.render();
    fumaca.pontos.visible = true;
    renderer.shadowMap.autoUpdate = autoSombra;
    renderer.shadowMap.needsUpdate = pedido;
  }

  function limparFumaca() {
    fumaca.estado.vida.fill(1);
    fumaca.estado.idade.fill(0);
  }

  return {
    render,
    atualizar,
    redimensionar,
    limparFumaca,
    definirPotencia(estagio, f) { potencia[estagio - 1] = f; },
    definirFumacaSolo(f) { fumacaSolo = f; },
    // Compila os shaders das chamas e passes no carregamento (senão a ignição trava ~80 ms)
    async precompilar() {
      jato1.grupo.visible = jato2.grupo.visible = true;
      calorPass.enabled = mistura.enabled = true;
      await renderer.compileAsync(scene, camera);
      composerBrilho.render();
      composer.render();
      jato1.grupo.visible = jato2.grupo.visible = false;
    },
    definirReduzido(b) { reduzido = b; },
    definirPausa(b) { pausado = b; },
    passeOclusao,
    fumacaVivas: () => fumaca.estado.vivas,
    liberar() {
      composer.dispose();
      composerBrilho.dispose();
      pretoOclusor.dispose();
      alvo.dispose();
      bloom.dispose();
    },
  };
}
