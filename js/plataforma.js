// Base de lançamento, zona de pouso e chão. Escala: 1 unidade = 10 m.
import * as THREE from 'three';
import { marcar } from './foguete.js';

export const TOPO_LAJE = 0.3;
export const BASE_FOGUETE = 0.92; // altura da origem do primeiro estágio sobre a plataforma
export const ZONA_POUSO = new THREE.Vector3(26, 0.06, -16);

function canvasTex(w, h, desenhar, cor = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  desenhar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (cor) t.colorSpace = THREE.SRGBColorSpace; // cor: sRGB; dado (relevo): padrão
  return t;
}

function ruido(g, w, h, base, variacao, n) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.random() * variacao;
    g.fillStyle = `rgba(${v > variacao / 2 ? '255,255,255' : '0,0,0'},${Math.random() * 0.07})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
}

function texturasConcreto(repeticao) {
  const desenho = (g, w, h) => {
    ruido(g, w, h, '#8b8a86', 1, 9000);
    g.fillStyle = 'rgba(0,0,0,0.25)'; // juntas de dilatação
    for (let x = 0; x < w; x += w / 4) g.fillRect(x, 0, 2, h);
    for (let y = 0; y < h; y += h / 4) g.fillRect(0, y, w, 2);
  };
  const map = canvasTex(256, 256, desenho);
  const bump = new THREE.CanvasTexture(map.image); // mesmo desenho: o relevo coincide com a cor e desenha uma vez só
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeticao, repeticao);
  }
  return { map, bump };
}

export function criarBase(qualidade) {
  const base = new THREE.Group();
  base.name = 'base';

  const concreto = texturasConcreto(3);
  const mat = {
    concreto: new THREE.MeshStandardMaterial({ map: concreto.map, bumpMap: concreto.bump, bumpScale: 0.6, roughness: 0.92 }),
    escuro: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.95 }),
    aco: new THREE.MeshStandardMaterial({ color: 0x7a7f85, roughness: 0.55, metalness: 0.7 }),
    acoClaro: new THREE.MeshStandardMaterial({ color: 0xb9bcbf, roughness: 0.4, metalness: 0.8 }),
    lampada: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 3 }),
    vidro: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.3, clearcoat: 1, ior: 1.5 }),
  };

  // Chão com textura de terreno
  const chaoTex = canvasTex(256, 256, (g, w, h) => ruido(g, w, h, '#4b4f43', 1, 14000));
  chaoTex.wrapS = chaoTex.wrapT = THREE.RepeatWrapping;
  chaoTex.repeat.set(1100, 1100);
  chaoTex.anisotropy = 8;
  mat.chao = new THREE.MeshStandardMaterial({ map: chaoTex, roughness: 1 });
  // Chão bem maior que o alcance da câmera: a borda nunca aparece, some na névoa
  const chao = new THREE.Mesh(new THREE.CircleGeometry(4000, 64), mat.chao);
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  base.add(chao);

  // Laje da plataforma
  const laje = marcar(new THREE.Mesh(new THREE.BoxGeometry(6, TOPO_LAJE, 6), mat.concreto), 'plataforma');
  laje.position.y = TOPO_LAJE / 2;
  base.add(laje);

  // Calha de chamas: canal escuro saindo de baixo do foguete
  const calha = marcar(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 3.6), mat.escuro), 'calha');
  calha.position.set(0, TOPO_LAJE + 0.002, 1.2);
  calha.castShadow = false;
  base.add(calha);

  // Mesa de lançamento: 4 pilares + garras (InstancedMesh)
  const pilares = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, BASE_FOGUETE - TOPO_LAJE - 0.1, 0.14), mat.aco, 4);
  const garras = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), mat.acoClaro, 4);
  const aux = new THREE.Object3D();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    aux.rotation.set(0, -a, 0);
    aux.position.set(Math.cos(a) * 0.32, TOPO_LAJE + (BASE_FOGUETE - TOPO_LAJE - 0.1) / 2, Math.sin(a) * 0.32);
    aux.updateMatrix();
    pilares.setMatrixAt(i, aux.matrix);
    aux.position.set(Math.cos(a) * 0.24, BASE_FOGUETE - 0.12, Math.sin(a) * 0.24);
    aux.updateMatrix();
    garras.setMatrixAt(i, aux.matrix);
  }
  base.add(marcar(pilares, 'plataforma'), marcar(garras, 'plataforma'));

  // Torre de serviço em treliça: colunas, vigas e diagonais com uma só geometria (InstancedMesh)
  const ALT = 8.2;
  const L = 0.44;
  const NIVEIS = 20;
  const passo = ALT / NIVEIS;
  const barras = [];
  const cantos = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [cx, cz] of cantos) barras.push({ p: [cx * L / 2, ALT / 2, cz * L / 2], s: [0.035, ALT, 0.035], r: [0, 0, 0] });
  for (let n = 1; n <= NIVEIS; n++) {
    const y = n * passo;
    barras.push({ p: [0, y, -L / 2], s: [L, 0.02, 0.02], r: [0, 0, 0] }, { p: [0, y, L / 2], s: [L, 0.02, 0.02], r: [0, 0, 0] });
    barras.push({ p: [-L / 2, y, 0], s: [0.02, 0.02, L], r: [0, 0, 0] }, { p: [L / 2, y, 0], s: [0.02, 0.02, L], r: [0, 0, 0] });
    const diag = Math.hypot(L, passo);
    const ang = Math.atan2(passo, L) * (n % 2 ? 1 : -1);
    barras.push({ p: [0, y - passo / 2, -L / 2], s: [diag, 0.014, 0.014], r: [0, 0, ang] }, { p: [0, y - passo / 2, L / 2], s: [diag, 0.014, 0.014], r: [0, 0, ang] });
    barras.push({ p: [-L / 2, y - passo / 2, 0], s: [0.014, 0.014, diag], r: [-ang, 0, 0] }, { p: [L / 2, y - passo / 2, 0], s: [0.014, 0.014, diag], r: [-ang, 0, 0] });
  }
  const trelica = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat.aco, barras.length);
  barras.forEach((b, i) => {
    aux.position.set(...b.p);
    aux.rotation.set(...b.r);
    aux.scale.set(...b.s);
    aux.updateMatrix();
    trelica.setMatrixAt(i, aux.matrix);
  });
  aux.scale.set(1, 1, 1);
  const torre = new THREE.Group();
  torre.position.set(-0.95, TOPO_LAJE, 0);
  torre.add(marcar(trelica, 'torre'));

  // Braço de acesso ao segundo estágio: gira para longe antes da decolagem
  const pivoBraco = new THREE.Group();
  pivoBraco.position.set(L / 2, 6.1, 0);
  const braco = marcar(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.12).translate(0.21, 0, 0), mat.acoClaro), 'torre');
  pivoBraco.add(braco);
  torre.add(pivoBraco);
  base.add(torre);

  // Postes com refletores (InstancedMesh para postes e lâmpadas; vidro na frente)
  const posPostes = [[3.6, 3.6], [-3.6, 3.6], [3.6, -3.6], [-3.6, -3.6]];
  const postes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.045, 5, 8), mat.aco, 4);
  const lampadas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.14, 0.06), mat.lampada, 4);
  const vidros = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.16, 0.01), mat.vidro, 4);
  posPostes.forEach(([x, z], i) => {
    const virado = Math.atan2(-x, -z); // refletor aponta para o foguete
    aux.rotation.set(0, 0, 0);
    aux.position.set(x, 2.5, z);
    aux.updateMatrix();
    postes.setMatrixAt(i, aux.matrix);
    aux.rotation.set(-0.5, virado, 0, 'YXZ');
    aux.position.set(x, 5.05, z);
    aux.updateMatrix();
    lampadas.setMatrixAt(i, aux.matrix);
    aux.translateZ(0.036);
    aux.updateMatrix();
    vidros.setMatrixAt(i, aux.matrix);
  });
  aux.rotation.set(0, 0, 0, 'XYZ');
  postes.castShadow = true;
  base.add(postes, lampadas, vidros);

  // Zona de pouso: círculo de concreto pintado
  const pintura = canvasTex(512, 512, (g, w, h) => {
    ruido(g, w, h, '#6f6e6a', 1, 12000);
    g.strokeStyle = '#e9ecea';
    g.lineWidth = 16;
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.43, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 10;
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.16, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#f2b51d';
    g.lineWidth = 22;
    g.beginPath(); g.moveTo(w * 0.36, h * 0.36); g.lineTo(w * 0.64, h * 0.64); g.moveTo(w * 0.64, h * 0.36); g.lineTo(w * 0.36, h * 0.64); g.stroke();
  });
  pintura.anisotropy = 8;
  mat.zona = new THREE.MeshStandardMaterial({ map: pintura, roughness: 0.9 });
  const zona = new THREE.Group();
  zona.position.set(ZONA_POUSO.x, 0, ZONA_POUSO.z);
  const borda = marcar(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.4, ZONA_POUSO.y, 64), mat.concreto), 'zona-pouso');
  borda.position.y = ZONA_POUSO.y / 2;
  const topo = marcar(new THREE.Mesh(new THREE.CircleGeometry(2.3, 64), mat.zona), 'zona-pouso');
  topo.rotation.x = -Math.PI / 2;
  topo.position.y = ZONA_POUSO.y + 0.002;
  zona.add(borda, topo);
  base.add(zona);

  return {
    grupo: base,
    recolherBraco(f) { pivoBraco.rotation.y = f * 1.4; },
    lampadas,
    materiais: mat,
  };
}
