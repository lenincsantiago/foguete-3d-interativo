// Escolhe a qualidade gráfica a partir do aparelho. Função pura: fácil de testar.
const NIVEIS = {
  alta: { sombra: 2048, particulas: 1400, maxRatio: 2 },
  media: { sombra: 1024, particulas: 700, maxRatio: 2 },
  baixa: { sombra: 1024, particulas: 350, maxRatio: 1.5 },
};

export function escolherQualidade({ largura, pixelRatio = 1, toque = false, nucleos } = {}) {
  let nivel = 'media';
  if (largura >= 1024 && !toque && (nucleos ?? 4) >= 4) nivel = 'alta';
  else if (largura < 600 && toque) nivel = 'baixa';
  const base = NIVEIS[nivel];
  return { nivel, ...base, pixelRatio: Math.min(pixelRatio, base.maxRatio) };
}

export function qualidadeDoAparelho() {
  return escolherQualidade({
    largura: window.innerWidth,
    pixelRatio: window.devicePixelRatio || 1,
    toque: matchMedia('(pointer: coarse)').matches,
    nucleos: navigator.hardwareConcurrency,
  });
}
