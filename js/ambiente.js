// Céu ao amanhecer, sol com sombras, luzes de estúdio (preenchimento e contraluz) e reflexos.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ELEVACAO = 2.5; // graus acima do horizonte: amanhecer, céu azul profundo e luz dourada rasante
const AZIMUTE = 25; // graus a partir do eixo +X

export function criarAmbiente(renderer, scene, qualidade) {
  const dirSol = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - ELEVACAO),
    THREE.MathUtils.degToRad(90 - AZIMUTE),
  );

  // Céu da hora azul: shader próprio (degradê + halo e disco do sol), com as cores da direção aprovada
  const ceu = new THREE.Mesh(
    new THREE.SphereGeometry(1000, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        zenite: { value: new THREE.Color(0x0b1d36) },
        meio: { value: new THREE.Color(0x2a4a72) },
        horizonte: { value: new THREE.Color(0xc98b5e) },
        solo: { value: new THREE.Color(0x3c4f68) }, // igual à névoa: chão distante e céu se encontram sem emenda
        solDir: { value: dirSol },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position.z = gl_Position.w; // sempre no fundo
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 zenite; uniform vec3 meio; uniform vec3 horizonte; uniform vec3 solo; uniform vec3 solDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          float s = max(dot(d, solDir), 0.0);
          vec3 horiz = mix(horizonte * 0.55, horizonte, pow(s, 3.0)); // horizonte mais quente do lado do sol
          vec3 c = mix(horiz, meio, smoothstep(-0.01, 0.2, h));
          c = mix(c, zenite, smoothstep(0.18, 0.75, h));
          c += vec3(1.0, 0.5, 0.25) * pow(s, 8.0) * 0.5 * (1.0 - smoothstep(0.0, 0.35, h));
          c += vec3(1.0, 0.85, 0.65) * pow(s, 900.0) * 6.0;
          c = mix(c, solo, smoothstep(0.0, -0.08, h));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  ceu.frustumCulled = false;
  ceu.renderOrder = -1;
  ceu.onBeforeRender = (r, s, cam) => ceu.position.copy(cam.position); // acompanha a câmera
  scene.add(ceu);
  scene.fog = new THREE.Fog(0x3c4f68, 150, 900);

  // Reflexos de estúdio: um ambiente gerado (RoomEnvironment), fraco para não "achatar" o céu
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sala = new RoomEnvironment();
  const env = pmrem.fromScene(sala, 0.04).texture;
  sala.dispose();
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.35;

  // Sol: luz principal, quente, com sombras
  const sol = new THREE.DirectionalLight(0xffc28f, 2.6);
  sol.castShadow = true;
  sol.shadow.mapSize.set(qualidade.sombra, qualidade.sombra);
  const cs = sol.shadow.camera;
  cs.left = -9; cs.right = 9; cs.top = 11; cs.bottom = -3;
  cs.near = 1; cs.far = 120;
  cs.updateProjectionMatrix();
  sol.shadow.normalBias = 0.02;
  sol.shadow.bias = -0.0002;
  scene.add(sol, sol.target);

  // Preenchimento do céu (azul por cima, terra por baixo) e contraluz fria
  const ceuLuz = new THREE.HemisphereLight(0x8fb0d6, 0x3a3128, 0.9);
  const contraluz = new THREE.DirectionalLight(0x9cc3ff, 1.1);
  contraluz.position.copy(dirSol).multiplyScalar(-40).setY(25);
  scene.add(ceuLuz, contraluz);

  // Refletores da base: dois spots quentes no foguete (sem sombra, baratos)
  const spots = [[3.6, 3.6], [-3.6, 3.6]].map(([x, z]) => {
    const s = new THREE.SpotLight(0xffd9a0, 40, 18, 0.45, 0.6, 2);
    s.position.set(x, 5.1, z);
    s.target.position.set(0, 3.5, 0);
    scene.add(s, s.target);
    return s;
  });

  const alvo = new THREE.Vector3();
  // Move a área de sombra para onde a câmera está olhando (base, céu ou zona de pouso)
  function focarSombra(ponto) {
    alvo.copy(ponto);
    sol.target.position.copy(alvo);
    sol.position.copy(alvo).addScaledVector(dirSol, 60);
  }
  focarSombra(new THREE.Vector3(0, 0, 0));

  return { ceu, sol, spots, focarSombra, ambienteTex: env };
}
