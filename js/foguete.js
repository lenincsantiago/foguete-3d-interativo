// Modelo do Vetor-2 feito só com código. Escala: 1 unidade = 10 m.
// Primeiro estágio com origem na base do tanque; segundo estágio com origem no topo do interestágio.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const R = 0.185; // raio do corpo (3,7 m)
const ALTURA_S1 = 4.1;
const ALTURA_INTER = 0.55;
export const TOPO_INTER = ALTURA_S1 + ALTURA_INTER;
export const ALTURA_PES = 0.74; // dos pés (pernas abertas) até a origem do primeiro estágio

// Malha clicável: guarda o id da peça e entra na camada 1 (só ela é testada no raycast)
export function marcar(obj, id) {
  obj.userData.peca = id;
  obj.layers.enable(1);
  obj.castShadow = true;
  obj.receiveShadow = true;
  return obj;
}

function canvas(w, h, desenhar) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  desenhar(c.getContext('2d'), w, h);
  return c;
}

// Cor do primeiro estágio: branco com fuligem perto dos motores (é um estágio reutilizado)
function texturaFuligem() {
  const t = new THREE.CanvasTexture(canvas(64, 512, (g, w, h) => {
    g.fillStyle = '#f1f2ef';
    g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, h, 0, h * 0.55);
    grad.addColorStop(0, 'rgba(70,62,55,0.55)');
    grad.addColorStop(1, 'rgba(70,62,55,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { // manchas verticais de fuligem escorrida
      g.fillStyle = `rgba(60,52,45,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, h * (0.6 + Math.random() * 0.4), 1 + Math.random() * 2, -Math.random() * 120);
    }
  }));
  t.colorSpace = THREE.SRGBColorSpace; // textura de cor
  return t;
}

// Relevo das chapas: linhas verticais e horizontais finas (dado, não cor)
function texturaChapas() {
  const t = new THREE.CanvasTexture(canvas(256, 512, (g, w, h) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a5a5a';
    for (let x = 0; x < w; x += w / 8) g.fillRect(x, 0, 2, h);
    for (let y = 0; y < h; y += h / 10) g.fillRect(0, y, w, 2);
  }));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t; // NoColorSpace (padrão): é bumpMap
}

// Grade das aletas: máscara de recorte (alphaMap lê o canal verde)
function texturaGrade() {
  const t = new THREE.CanvasTexture(canvas(128, 128, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.lineWidth = 3;
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(Math.PI / 4);
    for (let i = -w; i <= w; i += 14) {
      g.beginPath(); g.moveTo(i, -w); g.lineTo(i, w); g.stroke();
      g.beginPath(); g.moveTo(-w, i); g.lineTo(w, i); g.stroke();
    }
    g.restore();
  }));
  return t;
}

// Nome pintado na lateral, na vertical
function texturaNome() {
  const t = new THREE.CanvasTexture(canvas(128, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.translate(w / 2, h / 2);
    g.rotate(Math.PI / 2);
    g.fillStyle = '#16191d';
    g.font = '700 92px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('VETOR-2', 0, 0);
  }));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Perfil de sino de bocal para LatheGeometry
function perfilBocal(garganta, saida, comprimento, camara) {
  const pts = [new THREE.Vector2(garganta * 1.25, camara), new THREE.Vector2(garganta * 1.25, camara * 0.4), new THREE.Vector2(garganta, 0)];
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(garganta + (saida - garganta) * Math.sqrt(t), -comprimento * t));
  }
  return pts;
}

export function criarFoguete() {
  const mat = {
    tintaS1: new THREE.MeshPhysicalMaterial({ map: texturaFuligem(), bumpMap: texturaChapas(), bumpScale: 0.4, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
    tinta: new THREE.MeshPhysicalMaterial({ color: 0xf3f4f1, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }),
    painel: new THREE.MeshPhysicalMaterial({ color: 0xdfe1de, roughness: 0.45, clearcoat: 0.5 }),
    carbono: new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.48, metalness: 0.2, side: THREE.DoubleSide }),
    motor: new THREE.MeshStandardMaterial({ color: 0x55504c, roughness: 0.3, metalness: 1, side: THREE.DoubleSide }),
    niobio: new THREE.MeshStandardMaterial({ color: 0x2e2b29, roughness: 0.42, metalness: 0.85, side: THREE.DoubleSide }),
    titanio: new THREE.MeshStandardMaterial({ color: 0x9d968e, roughness: 0.42, metalness: 1, alphaMap: texturaGrade(), alphaTest: 0.5, side: THREE.DoubleSide }),
    aco: new THREE.MeshStandardMaterial({ color: 0x8d9094, roughness: 0.35, metalness: 1 }),
    vidro: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.28, clearcoat: 1, ior: 1.5 }),
    nome: new THREE.MeshStandardMaterial({ map: texturaNome(), alphaTest: 0.5, roughness: 0.4 }),
  };

  const foguete = new THREE.Group();
  foguete.name = 'foguete';

  // ---------- Primeiro estágio ----------
  const s1 = new THREE.Group();
  s1.name = 'estagio1';
  foguete.add(s1);

  const corpo = marcar(new THREE.Mesh(new THREE.CylinderGeometry(R, R, ALTURA_S1, 64), mat.tintaS1), 'primeiro-estagio');
  corpo.position.y = ALTURA_S1 / 2;
  s1.add(corpo);

  const nome = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.002, R + 0.002, 1.7, 24, 1, true, Math.PI * 0.35, 0.8), mat.nome);
  nome.position.y = 2.6;
  marcar(nome, 'primeiro-estagio');
  s1.add(nome);

  const inter = marcar(new THREE.Mesh(new THREE.CylinderGeometry(R, R, ALTURA_INTER, 64, 1, true), mat.carbono), 'interestagio');
  inter.position.y = ALTURA_S1 + ALTURA_INTER / 2;
  s1.add(inter);

  const saia = marcar(new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.06, 0.12, 48), mat.carbono), 'motores');
  saia.position.y = -0.06;
  s1.add(saia);

  // Juntas de solda: anéis finos repetidos (InstancedMesh, 1 chamada de desenho)
  const alturasJuntas = [0.55, 1.35, 2.15, 2.95, 3.7];
  const juntas = new THREE.InstancedMesh(new THREE.TorusGeometry(R + 0.0012, 0.0045, 6, 72), mat.painel, alturasJuntas.length);
  const aux = new THREE.Object3D();
  alturasJuntas.forEach((y, i) => {
    aux.position.set(0, y, 0);
    aux.rotation.set(Math.PI / 2, 0, 0);
    aux.updateMatrix();
    juntas.setMatrixAt(i, aux.matrix);
  });
  s1.add(marcar(juntas, 'juntas'));

  // Parafusos: dois anéis de 40 (InstancedMesh)
  const porAnel = 40;
  const parafusos = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.008, 6), mat.aco, porAnel * 2);
  [ALTURA_S1 + 0.03, 0.05].forEach((y, anel) => {
    for (let i = 0; i < porAnel; i++) {
      const a = (i / porAnel) * Math.PI * 2;
      aux.position.set(Math.cos(a) * (R + 0.003), y, Math.sin(a) * (R + 0.003));
      aux.rotation.set(0, -a, Math.PI / 2);
      aux.updateMatrix();
      parafusos.setMatrixAt(anel * porAnel + i, aux.matrix);
    }
  });
  s1.add(marcar(parafusos, 'parafusos'));

  // Painéis de acesso em relevo
  const paineis = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.16, 0.09), mat.painel, 6);
  [[0.8, 1.2], [1.6, 4.1], [2.3, 1.9], [3.1, 3.4], [3.45, 5.3], [1.1, 5.6]].forEach(([y, a], i) => {
    aux.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
    aux.rotation.set(0, -a, 0);
    aux.updateMatrix();
    paineis.setMatrixAt(i, aux.matrix);
  });
  s1.add(marcar(paineis, 'paineis'));

  // Duto de cabos ao longo do corpo
  const duto = marcar(new THREE.Mesh(new THREE.BoxGeometry(0.03, 3.9, 0.05), mat.tinta), 'primeiro-estagio');
  duto.position.set(Math.cos(0.4) * (R + 0.012), 2.05, Math.sin(0.4) * (R + 0.012));
  duto.rotation.y = -0.4;
  s1.add(duto);

  // Câmera de bordo: caixa escura + cúpula de vidro
  const cam = new THREE.Group();
  const caixa = marcar(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.04), mat.carbono), 'camera');
  const cupula = marcar(new THREE.Mesh(new THREE.SphereGeometry(0.017, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat.vidro), 'camera');
  cupula.rotation.z = -Math.PI / 2;
  cupula.position.x = 0.015;
  cupula.castShadow = false;
  cam.add(caixa, cupula);
  cam.position.set(Math.cos(2.6) * (R + 0.015), 3.95, Math.sin(2.6) * (R + 0.015));
  cam.rotation.y = -2.6;
  s1.add(cam);

  // Nove motores: 8 em anel + 1 no centro (InstancedMesh)
  const geoBocal = new THREE.LatheGeometry(perfilBocal(0.017, 0.052, 0.24, 0.06), 28);
  const motores = new THREE.InstancedMesh(geoBocal, mat.motor, 9);
  const saidasMotores = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i === 8 ? 0 : 0.125;
    aux.position.set(Math.cos(a) * r, -0.12, Math.sin(a) * r);
    aux.rotation.set(0, 0, 0);
    aux.updateMatrix();
    motores.setMatrixAt(i, aux.matrix);
    saidasMotores.push(new THREE.Vector3(aux.position.x, -0.36, aux.position.z));
  }
  s1.add(marcar(motores, 'motores'));

  // Aletas de grade: recolhidas junto ao corpo; abrirAletas(1) deixa na horizontal
  const geoAleta = new THREE.PlaneGeometry(0.11, 0.13).rotateY(Math.PI / 2).translate(0.012, -0.065, 0);
  const aletas = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const pivo = new THREE.Group();
    pivo.position.set(Math.cos(a) * R, ALTURA_S1 + ALTURA_INTER - 0.04, Math.sin(a) * R);
    pivo.rotation.y = -a;
    const aleta = marcar(new THREE.Mesh(geoAleta, mat.titanio), 'aletas');
    pivo.add(aleta);
    s1.add(pivo);
    aletas.push(aleta);
  }

  // Pernas de pouso: dobradas para cima; abrirPernas(1) abre para baixo e para fora
  const geoPerna = mergeGeometries([
    new THREE.BoxGeometry(0.05, 1.0, 0.035).translate(0.028, 0.5, 0),
    new THREE.CylinderGeometry(0.045, 0.05, 0.025, 16).translate(0.04, 1.0, 0),
  ]);
  const pernas = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const pivo = new THREE.Group();
    pivo.position.set(Math.cos(a) * R, 0.12, Math.sin(a) * R);
    pivo.rotation.y = -a;
    const perna = marcar(new THREE.Mesh(geoPerna, mat.carbono), 'pernas');
    pivo.add(perna);
    s1.add(pivo);
    pernas.push(perna);
  }

  // ---------- Segundo estágio ----------
  const s2 = new THREE.Group();
  s2.name = 'estagio2';
  s2.position.y = TOPO_INTER;
  foguete.add(s2);

  const mvac = marcar(new THREE.Mesh(new THREE.LatheGeometry(perfilBocal(0.03, 0.15, 0.4, 0.05), 40), mat.niobio), 'motor-vacuo');
  s2.add(mvac);

  const corpo2 = marcar(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.2, 64), mat.tinta), 'segundo-estagio');
  corpo2.position.y = 0.6;
  s2.add(corpo2);

  const transicao = marcar(new THREE.Mesh(new THREE.CylinderGeometry(0.26, R, 0.15, 64), mat.tinta), 'carenagem');
  transicao.position.y = 1.275;
  s2.add(transicao);

  const perfilCarenagem = [new THREE.Vector2(0.26, 0), new THREE.Vector2(0.26, 0.7)];
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    perfilCarenagem.push(new THREE.Vector2(Math.max(0.26 * Math.pow(Math.cos((t * Math.PI) / 2), 0.75), 0.0001), 0.7 + 0.68 * t));
  }
  const carenagem = marcar(new THREE.Mesh(new THREE.LatheGeometry(perfilCarenagem, 64), mat.tinta), 'carenagem');
  carenagem.position.y = 1.35;
  s2.add(carenagem);

  const costura = marcar(new THREE.Mesh(new THREE.TorusGeometry(0.2602, 0.003, 6, 72), mat.painel), 'carenagem');
  costura.rotation.x = Math.PI / 2;
  costura.position.y = 1.36;
  s2.add(costura);

  return {
    grupo: foguete,
    estagio1: s1,
    estagio2: s2,
    saidasMotores, // locais ao estágio 1
    saidaMvac: new THREE.Vector3(0, -0.44, 0), // local ao estágio 2
    abrirAletas(f) { for (const a of aletas) a.rotation.z = f * Math.PI / 2; },
    abrirPernas(f) { for (const p of pernas) p.rotation.z = -f * 2.53; },
    materiais: mat,
  };
}

// Libera da GPU geometrias, materiais e texturas de uma árvore inteira
export function liberar(raiz) {
  const mats = new Set();
  raiz.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [o.material ?? []].flat()) mats.add(m);
    if (o.isInstancedMesh) o.dispose();
  });
  for (const m of mats) {
    for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
    m.dispose();
  }
}
