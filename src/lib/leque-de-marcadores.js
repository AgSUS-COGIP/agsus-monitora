/*
  LEQUE FIXO PARA MARCADORES QUE CAEM NO MESMO LUGAR

  No mapa nacional da Saúde Indígena, Leste de Roraima e Yanomami têm a sede
  em Boa Vista, a 1,8 km uma da outra: na tela são o mesmo pixel em qualquer
  zoom de país ou de estado, e a bolha de baixo só aparecia como anel. Alto Rio
  Solimões (Tabatinga) e Vale do Javari (Atalaia do Norte) ficam a 3–5 px no
  zoom nacional.

  A coordenada não muda. O que muda é onde o marcador é DESENHADO: cada membro
  de um grupo vai para um pequeno círculo em volta do centro do grupo, com
  deslocamento em pixels de tela, e quem desenha liga o ponto real ao marcador
  com um traço. Recalcula-se a cada zoom; quando os pontos reais já estão mais
  afastados do que o diâmetro do leque, o grupo desfaz-se sozinho e ninguém é
  deslocado.

  Tudo aqui é aritmética de pixels, sem Leaflet, para poder ser testado.
*/

export const RAIO_DO_LEQUE = 16;

/*
  Ângulo do i-ésimo de n, igualmente espaçados e começando EM CIMA. Em
  coordenadas de tela o y cresce para baixo, por isso "em cima" é −π/2.
*/
export function anguloNoLeque(indice, total) {
  const n = Math.max(1, Number(total) || 1);
  return -Math.PI / 2 + (2 * Math.PI * indice) / n;
}

/*
  Agrupa por proximidade na tela com ligação simples: dois pontos a menos de
  `limitePx` ficam no mesmo grupo, e o grupo cresce por transitividade. A
  ordem é a da entrada — os grupos pela posição do primeiro membro e os
  membros por índice —, para que a mesma entrada dê sempre o mesmo leque.
*/
export function agruparNaTela(pontos, limitePx = 2 * RAIO_DO_LEQUE) {
  const lista = Array.isArray(pontos) ? pontos : [];
  const pai = lista.map((_, i) => i);
  const raiz = (i) => {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]];
      i = pai[i];
    }
    return i;
  };
  const valido = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

  for (let i = 0; i < lista.length; i++) {
    if (!valido(lista[i])) continue;
    for (let j = i + 1; j < lista.length; j++) {
      if (!valido(lista[j])) continue;
      const d = Math.hypot(lista[i].x - lista[j].x, lista[i].y - lista[j].y);
      if (d > limitePx) continue;
      const a = raiz(i);
      const b = raiz(j);
      // A raiz é sempre o menor índice: é o que mantém a ordem estável.
      if (a !== b) pai[Math.max(a, b)] = Math.min(a, b);
    }
  }

  const grupos = new Map();
  lista.forEach((_, i) => {
    const r = raiz(i);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(i);
  });
  return [...grupos.values()];
}

/*
  Para cada ponto de entrada devolve o deslocamento {dx, dy} a somar ao SEU
  ponto de tela. Um ponto sozinho tem deslocamento zero. Num grupo, o membro
  i vai para centro + raio·(cos θi, sin θi), com o centro na média do grupo —
  no caso de sedes coincidentes, o próprio ponto.
*/
export function calcularLeque(
  pontos,
  { raio = RAIO_DO_LEQUE, limitePx = 2 * raio } = {},
) {
  const lista = Array.isArray(pontos) ? pontos : [];
  const saida = lista.map(() => ({ dx: 0, dy: 0, emLeque: false }));

  agruparNaTela(lista, limitePx).forEach((grupo) => {
    if (grupo.length < 2) return;
    const cx = grupo.reduce((s, i) => s + lista[i].x, 0) / grupo.length;
    const cy = grupo.reduce((s, i) => s + lista[i].y, 0) / grupo.length;
    grupo.forEach((i, k) => {
      const theta = anguloNoLeque(k, grupo.length);
      saida[i] = {
        dx: cx + raio * Math.cos(theta) - lista[i].x,
        dy: cy + raio * Math.sin(theta) - lista[i].y,
        emLeque: true,
      };
    });
  });

  return saida;
}
