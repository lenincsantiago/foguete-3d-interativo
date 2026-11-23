// Roteiro do voo: quando cada fase começa (segundos na linha do tempo) e como mostrar a telemetria.
// Sem three.js nem GSAP, para poder ser testado no Node.

export const T = {
  contagem: 0,
  ignicao: 5,
  decolagem: 7,
  meco: 21,
  separacao: 23,
  pouso: 32, // queima de pouso
  fim: 40,
};

export const FASES = ['contagem', 'ignicao', 'decolagem', 'meco', 'separacao', 'pouso'];

export function faseEm(t) {
  if (t < 0) return null;
  if (t >= T.fim) return 'fim';
  let atual = FASES[0];
  for (const f of FASES) if (t >= T[f]) atual = f;
  return atual;
}

export function contagemEm(t) {
  if (t < 0 || t >= T.ignicao) return null;
  return `T−${Math.ceil(T.ignicao - t)}`;
}

// A cena é comprimida: 1 unidade de altura vale 0,52 km na tela, para os números lembrarem um voo real
const KM_POR_UNIDADE = 0.52;
const KMH_POR_UNIDADE_S = 520;
const km = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function formatarAltitude(unidades) {
  return `${km.format(Math.max(0, unidades) * KM_POR_UNIDADE)} km`;
}

export function formatarVelocidade(unidadesPorSeg) {
  return `${inteiro.format(Math.abs(unidadesPorSeg) * KMH_POR_UNIDADE_S)} km/h`;
}
