// Nome e explicação de cada peça clicável. Cada malha 3D guarda o id em userData.peca.
export const PECAS = {
  carenagem: {
    nome: 'Carenagem',
    texto: 'A ponta do foguete. Protege a carga (um satélite, por exemplo) do vento e do calor na subida e se abre quando o ar fica rarefeito.',
    grupo: 'Segundo estágio',
  },
  'segundo-estagio': {
    nome: 'Segundo estágio',
    texto: 'A parte de cima, com tanques próprios. Assume o voo depois da separação e leva a carga até a órbita.',
    grupo: 'Segundo estágio',
  },
  'motor-vacuo': {
    nome: 'Motor de vácuo',
    texto: 'Um motor só, com um bocal bem largo. O bocal grande rende mais no vácuo, onde não há ar empurrando de volta.',
    grupo: 'Segundo estágio',
  },
  interestagio: {
    nome: 'Interestágio',
    texto: 'O anel preto de fibra de carbono que liga os dois estágios. Esconde o motor do segundo estágio até a separação.',
    grupo: 'Primeiro estágio',
  },
  aletas: {
    nome: 'Aletas de grade',
    texto: 'Quatro grades de titânio que ficam recolhidas na subida. Na volta, abrem e guiam o estágio pelo ar, como lemes.',
    grupo: 'Primeiro estágio',
  },
  'primeiro-estagio': {
    nome: 'Primeiro estágio',
    texto: 'A parte maior, com os tanques de oxigênio líquido e querosene. Faz a força bruta da decolagem e depois volta para pousar.',
    grupo: 'Primeiro estágio',
  },
  paineis: {
    nome: 'Painéis do tanque',
    texto: 'O casco é feito de chapas de alumínio-lítio curvadas e soldadas. A pintura branca reflete o sol e ajuda a manter o combustível frio.',
    grupo: 'Primeiro estágio',
  },
  juntas: {
    nome: 'Juntas de solda',
    texto: 'Os anéis onde as chapas do tanque se encontram. Cada junta precisa segurar a pressão interna e o peso do foguete inteiro.',
    grupo: 'Primeiro estágio',
  },
  parafusos: {
    nome: 'Parafusos de fixação',
    texto: 'Fileiras de parafusos prendem o interestágio e a base dos motores ao tanque. São dezenas em cada anel.',
    grupo: 'Primeiro estágio',
  },
  motores: {
    nome: 'Nove motores',
    texto: 'Oito motores em círculo e um no centro. Juntos empurram o foguete para cima. Na volta, só alguns religam para frear e pousar.',
    grupo: 'Primeiro estágio',
  },
  pernas: {
    nome: 'Pernas de pouso',
    texto: 'Quatro pernas de fibra de carbono dobradas junto ao corpo. Abrem nos segundos finais da descida, e o estágio pousa de pé para voar de novo.',
    grupo: 'Primeiro estágio',
  },
  camera: {
    nome: 'Câmera de bordo',
    texto: 'Uma câmera atrás de uma cúpula de vidro filma a separação dos estágios e o pouso.',
    grupo: 'Primeiro estágio',
  },
  plataforma: {
    nome: 'Plataforma de lançamento',
    texto: 'Base de concreto que segura o foguete preso por garras até os motores atingirem força total.',
    grupo: 'Base de lançamento',
  },
  calha: {
    nome: 'Calha de chamas',
    texto: 'Um canal sob a plataforma que desvia o fogo e o vapor dos motores para longe do foguete na decolagem.',
    grupo: 'Base de lançamento',
  },
  torre: {
    nome: 'Torre de serviço',
    texto: 'Estrutura de aço ao lado do foguete. Leva combustível, energia e dados até o momento da decolagem.',
    grupo: 'Base de lançamento',
  },
  'zona-pouso': {
    nome: 'Zona de pouso',
    texto: 'Um círculo de concreto perto da base. É aqui que o primeiro estágio volta para pousar.',
    grupo: 'Base de lançamento',
  },
};

export function peca(id) {
  return PECAS[id] ?? null;
}
