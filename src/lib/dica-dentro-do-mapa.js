/*
  DICAS E POPUPS DENTRO DO MAPA

  O mapa "quebrava o nome" perto da borda: a dica do Leaflet (`L.tooltip`,
  `direction: "top"`, `white-space: nowrap`) fica centrada acima do ponto e,
  com o ponto a poucos pixels da borda, metade dela saía do contêiner do mapa
  (que corta o que transborda). Medido: o DSEI Potiguara, na ponta leste,
  perdia até 134 px do nome. O popup do clique tinha o mesmo risco em mapas
  estreitos (celular, modo detalhado do DSEI), com a largura fixa de 300 px.

  A peça vale para os mapas da Saúde Indígena (React) e para o de Projetos
  (legado) — um ouvinte por mapa, que pega toda dica e todo popup que abrir
  nele, inclusive os das camadas de Terras Indígenas:

  - dica: ao abrir, mede a dica e o mapa e escolhe a direção que cabe
    (a pedida, a oposta, depois o lado com mais espaço e o outro); se nenhuma
    cabe inteira, a que menos transborda, empurrada para dentro do mapa (sem a
    seta, que não apontaria mais para o ponto). A largura tem teto e o texto quebra
    na palavra (`.dica-no-mapa` em src/ui/ui.css) em vez de uma linha sem fim;
  - popup: largura máxima e altura máxima relativas ao tamanho do mapa, e o
    `autoPan` com folga suficiente para não ficar sob os controles.

  A escolha da direção é pura (`escolherDirecaoDaDica`), testada com os casos
  de borda; o resto só mede e repete o posicionamento do próprio Leaflet
  (`setLatLng`, `update`), sem tocar no conteúdo.
*/

export const CLASSE_DA_DICA = "dica-no-mapa";
export const CLASSE_DA_DICA_DESLOCADA = "dica-no-mapa--deslocada";
export const CLASSE_DO_POPUP = "popup-no-mapa";

/* Espaço mínimo entre a dica (ou o popup) e a borda do mapa. */
export const FOLGA_DA_BORDA = 8;
/* A seta da dica do Leaflet: 6 px de margem para o lado da direção. */
export const DISTANCIA_DA_SETA = 6;
export const LARGURA_MAXIMA_DA_DICA = 280;
export const LARGURA_MINIMA_DA_DICA = 120;
export const LARGURA_MAXIMA_DO_POPUP = 320;
export const LARGURA_MINIMA_DO_POPUP = 160;

/*
  Folga do autoPan: a de cima à esquerda é maior por causa dos botões de zoom
  (e, no alto, do seletor Mapa/Satélite); a de baixo à direita deixa a
  atribuição e a régua à vista.
*/
export const FOLGA_DO_POPUP_EM_CIMA = Object.freeze([52, 24]);
export const FOLGA_DO_POPUP_EMBAIXO = Object.freeze([24, 24]);

const OPOSTA = Object.freeze({
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
});

const finito = (valor, reserva = 0) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : reserva;
};

/*
  O retângulo da dica em cada direção, com a âncora (o ponto da dica no
  mapa, em pixels do contêiner) e a seta. É a conta do `_setPosition` do
  Leaflet 1.9 com as margens da seta do leaflet.css.
*/
export function retanguloDaDica(direcao, { ancora, largura, altura }) {
  const x = finito(ancora?.x);
  const y = finito(ancora?.y);
  const d = DISTANCIA_DA_SETA;
  if (direcao === "bottom")
    return { x: x - largura / 2, y: y + d, largura, altura };
  if (direcao === "left")
    return { x: x - d - largura, y: y - altura / 2, largura, altura };
  if (direcao === "right")
    return { x: x + d, y: y - altura / 2, largura, altura };
  return { x: x - largura / 2, y: y - d - altura, largura, altura };
}

/* Quantos pixels do retângulo ficam fora da área útil (soma dos quatro lados). */
export function transbordamento(retangulo, area, folga = FOLGA_DA_BORDA) {
  const esquerda = Math.max(0, folga - retangulo.x);
  const topo = Math.max(0, folga - retangulo.y);
  const direita = Math.max(
    0,
    retangulo.x + retangulo.largura - (area.largura - folga),
  );
  const base = Math.max(
    0,
    retangulo.y + retangulo.altura - (area.altura - folga),
  );
  return esquerda + topo + direita + base;
}

/*
  Quanto empurrar o retângulo para ele ficar dentro da área útil (o que sobra
  de um lado vai para o outro; maior que a área, encosta no começo).
*/
export function deslocamentoParaCaber(retangulo, area, folga = FOLGA_DA_BORDA) {
  const eixo = (inicio, tamanho, limite) => {
    if (inicio < folga || tamanho > limite - 2 * folga) return folga - inicio;
    const fim = inicio + tamanho;
    return fim > limite - folga ? limite - folga - fim : 0;
  };
  return {
    dx: eixo(retangulo.x, retangulo.largura, area.largura),
    dy: eixo(retangulo.y, retangulo.altura, area.altura),
  };
}

/*
  A ordem de tentativa: a direção pedida, a oposta e então os dois lados,
  primeiro o que tem mais espaço (à direita de quem está na metade esquerda).
  Pedida à esquerda ou à direita, a outra lateral vem antes de cima/embaixo.
*/
export function ordemDasDirecoes(preferida, ancora, area) {
  const pedida = OPOSTA[preferida] ? preferida : "top";
  const ladoComMaisEspaco =
    finito(ancora?.x) < finito(area?.largura) / 2 ? "right" : "left";
  const lados = [ladoComMaisEspaco, OPOSTA[ladoComMaisEspaco]];
  const verticais = ["top", "bottom"];
  const resto =
    pedida === "top" || pedida === "bottom"
      ? lados
      : [
          ...verticais.filter((v) => v !== pedida),
          ...lados.filter((l) => l !== pedida && l !== OPOSTA[pedida]),
        ];
  return [...new Set([pedida, OPOSTA[pedida], ...resto, ...verticais])];
}

/**
 * A direção da dica que cabe no mapa.
 *
 * @param {object} medida
 * @param {{x:number,y:number}} medida.ancora  ponto da dica, em px do contêiner
 * @param {number} medida.largura              largura da dica
 * @param {number} medida.altura               altura da dica
 * @param {{largura:number,altura:number}} medida.area  tamanho do contêiner
 * @param {string} [medida.preferida]          direção pedida (padrão "top")
 * @param {number} [medida.folga]              espaço mínimo até a borda
 * @returns {{direcao: string, transborda: number, deslocamento: {dx: number, dy: number}}}
 *   `deslocamento` só não é zero quando nenhuma direção cabe inteira: o quanto
 *   empurrar a dica (na direção que menos transborda) para dentro do mapa.
 */
export function escolherDirecaoDaDica({
  ancora,
  largura,
  altura,
  area,
  preferida = "top",
  folga = FOLGA_DA_BORDA,
}) {
  const medida = {
    ancora,
    largura: Math.max(0, finito(largura)),
    altura: Math.max(0, finito(altura)),
  };
  const util = {
    largura: Math.max(0, finito(area?.largura)),
    altura: Math.max(0, finito(area?.altura)),
  };
  const ordem = ordemDasDirecoes(preferida, ancora, util);
  const parado = { dx: 0, dy: 0 };
  // Sem medida (mapa escondido, teste sem layout): fica a pedida.
  if (!util.largura || !util.altura || !medida.largura)
    return { direcao: ordem[0], transborda: 0, deslocamento: parado };
  let melhor = null;
  for (const direcao of ordem) {
    const retangulo = retanguloDaDica(direcao, medida);
    const transborda = transbordamento(retangulo, util, folga);
    if (transborda === 0) return { direcao, transborda, deslocamento: parado };
    if (!melhor || transborda < melhor.transborda)
      melhor = { direcao, transborda, retangulo };
  }
  return {
    direcao: melhor.direcao,
    transborda: melhor.transborda,
    deslocamento: deslocamentoParaCaber(melhor.retangulo, util, folga),
  };
}

/* O teto da largura da dica num mapa desta largura (mapa estreito, dica estreita). */
export function larguraMaximaDaDica(larguraDoMapa, folga = FOLGA_DA_BORDA) {
  const disponivel = finito(larguraDoMapa) - 2 * folga;
  if (disponivel <= 0) return LARGURA_MAXIMA_DA_DICA;
  return Math.max(
    Math.min(LARGURA_MINIMA_DA_DICA, disponivel),
    Math.min(LARGURA_MAXIMA_DA_DICA, disponivel),
  );
}

/*
  As opções do popup para um mapa deste tamanho: a largura nunca passa da do
  mapa menos as folgas do autoPan, e a altura máxima faz o conteúdo longo
  rolar dentro do balão em vez de sair por cima. Sem medida, as de sempre.
*/
export function opcoesDoPopup({ largura, altura } = {}) {
  const w = finito(largura);
  const h = finito(altura);
  const folgaLateral = FOLGA_DO_POPUP_EM_CIMA[0] + FOLGA_DO_POPUP_EMBAIXO[0];
  const folgaVertical =
    FOLGA_DO_POPUP_EM_CIMA[1] + FOLGA_DO_POPUP_EMBAIXO[1] + 40; // seta + fechar
  // Conteúdo do Leaflet: 20 px de margem de cada lado dentro do balão.
  const maxWidth =
    w > 0
      ? Math.max(
          Math.min(LARGURA_MINIMA_DO_POPUP, w - folgaLateral - 40),
          Math.min(LARGURA_MAXIMA_DO_POPUP, w - folgaLateral - 40),
          80,
        )
      : LARGURA_MAXIMA_DO_POPUP;
  const opcoes = {
    className: CLASSE_DO_POPUP,
    maxWidth,
    minWidth: Math.min(LARGURA_MINIMA_DO_POPUP, maxWidth),
    autoPan: true,
    keepInView: true,
    autoPanPaddingTopLeft: [...FOLGA_DO_POPUP_EM_CIMA],
    autoPanPaddingBottomRight: [...FOLGA_DO_POPUP_EMBAIXO],
  };
  if (h > 0) opcoes.maxHeight = Math.max(120, h - folgaVertical);
  return opcoes;
}

/* Medida do contêiner do mapa (0 quando escondido). */
function medidaDoMapa(mapa) {
  const elemento = mapa?.getContainer?.();
  return {
    largura: finito(elemento?.clientWidth),
    altura: finito(elemento?.clientHeight),
  };
}

const pedidas = new WeakMap();

const comoPar = (offset) =>
  Array.isArray(offset)
    ? [finito(offset[0]), finito(offset[1])]
    : [finito(offset?.x), finito(offset?.y)];

/*
  Reposiciona a dica aberta: volta à direção e ao deslocamento pedidos, aplica
  a largura máxima, mede (já com a quebra de linha) e troca de direção se a
  pedida não couber. Se nenhuma couber inteira (canto de um mapa pequeno),
  fica a que menos transborda, empurrada para dentro — e sem a seta, que não
  apontaria mais para o ponto. `medir` existe para o teste (o jsdom não tem
  layout).
*/
export function ajustarDica(mapa, dica, { medir = medirDica } = {}) {
  const elemento = dica?.getElement?.();
  if (!mapa || !elemento || !dica.options) return null;
  if (!pedidas.has(dica))
    pedidas.set(dica, {
      direcao: dica.options.direction || "top",
      deslocamento: comoPar(dica.options.offset),
    });
  const { direcao: preferida, deslocamento: original } = pedidas.get(dica);
  // "center" e "auto" ficam como o Leaflet faz.
  if (!OPOSTA[preferida]) return null;
  const area = medidaDoMapa(mapa);
  elemento.classList.add(CLASSE_DA_DICA);
  if (area.largura)
    elemento.style.maxWidth = `${larguraMaximaDaDica(area.largura)}px`;
  const atual = comoPar(dica.options.offset);
  if (
    dica.options.direction !== preferida ||
    atual[0] !== original[0] ||
    atual[1] !== original[1]
  ) {
    dica.options.direction = preferida;
    dica.options.offset = [...original];
    dica.setLatLng?.(dica.getLatLng());
  }
  elemento.classList.remove(CLASSE_DA_DICA_DESLOCADA);
  const medida = medir(mapa, dica, elemento, preferida);
  if (!medida) return null;
  const { direcao, deslocamento } = escolherDirecaoDaDica({
    ...medida,
    area,
    preferida,
  });
  const empurrada = Boolean(deslocamento.dx || deslocamento.dy);
  if (direcao !== dica.options.direction || empurrada) {
    dica.options.direction = direcao;
    dica.options.offset = [
      original[0] + deslocamento.dx,
      original[1] + deslocamento.dy,
    ];
    elemento.classList.toggle(CLASSE_DA_DICA_DESLOCADA, empurrada);
    dica.setLatLng?.(dica.getLatLng());
  }
  return direcao;
}

/*
  Mede a dica já posicionada pelo Leaflet na direção `direcao` e devolve a
  âncora que ele usou (a ponta da seta), em pixels do contêiner.
*/
export function medirDica(mapa, _dica, elemento, direcao) {
  const caixa = elemento.getBoundingClientRect?.();
  const moldura = mapa.getContainer?.()?.getBoundingClientRect?.();
  if (!caixa || !moldura || !caixa.width) return null;
  const x = caixa.left - moldura.left;
  const y = caixa.top - moldura.top;
  const d = DISTANCIA_DA_SETA;
  const ancora =
    direcao === "bottom"
      ? { x: x + caixa.width / 2, y: y - d }
      : direcao === "left"
        ? { x: x + caixa.width + d, y: y + caixa.height / 2 }
        : direcao === "right"
          ? { x: x - d, y: y + caixa.height / 2 }
          : { x: x + caixa.width / 2, y: y + caixa.height + d };
  return { ancora, largura: caixa.width, altura: caixa.height };
}

/* Popup aberto: opções do tamanho atual do mapa e o autoPan refeito com elas. */
export function ajustarPopup(mapa, popup) {
  if (!mapa || !popup?.options) return null;
  const opcoes = opcoesDoPopup(medidaDoMapa(mapa));
  const { className, ...resto } = opcoes;
  Object.assign(popup.options, resto);
  popup.getElement?.()?.classList?.add(className);
  popup.update?.();
  return opcoes;
}

/**
 * Liga o ajuste a um mapa do Leaflet: toda dica e todo popup que abrir nele.
 * Devolve a função que desliga (o `remove` do mapa também desfaz).
 */
export function manterDicasDentroDoMapa(mapa, { medir = medirDica } = {}) {
  if (!mapa?.on) return () => {};
  const seguindo = new Map();
  const aoAbrirDica = (evento) => {
    const dica = evento?.tooltip;
    ajustarDica(mapa, dica, { medir });
    // A dica que segue o ponteiro (`sticky`) é reposicionada a cada movimento.
    const origem = dica?._source;
    if (dica?.options?.sticky && origem?.on && !seguindo.has(dica)) {
      const aoMover = () => ajustarDica(mapa, dica, { medir });
      origem.on("mousemove", aoMover);
      seguindo.set(dica, () => origem.off?.("mousemove", aoMover));
    }
  };
  const aoFecharDica = (evento) => {
    const parar = seguindo.get(evento?.tooltip);
    if (!parar) return;
    parar();
    seguindo.delete(evento.tooltip);
  };
  const aoAbrirPopup = (evento) => ajustarPopup(mapa, evento?.popup);
  mapa.on("tooltipopen", aoAbrirDica);
  mapa.on("tooltipclose", aoFecharDica);
  mapa.on("popupopen", aoAbrirPopup);
  return () => {
    mapa.off?.("tooltipopen", aoAbrirDica);
    mapa.off?.("tooltipclose", aoFecharDica);
    mapa.off?.("popupopen", aoAbrirPopup);
    for (const parar of seguindo.values()) parar();
    seguindo.clear();
  };
}
