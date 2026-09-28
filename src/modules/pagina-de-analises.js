/*
  A página Análises curriculares (`#page-analises`, view `analises`).

  É o app de análises (`analises.html`) num quadro que pertence à página, com
  endereço fixo do próprio MONITORA (`enderecoDasAnalises`) e a área atual do
  menu na URL (`?area=`). Antes era um painel externo (`openPanel` do legado);
  o comportamento que vinha de lá continua o mesmo:

  - o quadro nasce na primeira abertura, e não na entrada;
  - aberto de novo na mesma área, fica como está (não recarrega);
  - a área mudou: o quadro é refeito com a nova — na hora, se a página está
    aberta; senão, na próxima abertura;
  - até os dados aparecerem, o skeleton de painel cobre o quadro
    (`acompanharCarregamentoDoPainel`, com os avisos `agsus:painel-carregando`
    e `agsus:painel-pronto` de `docs/painel-externo-avisa-que-carregou.md`).

  O quadro leva a classe `external-panel`, como os dos painéis: é ela que dá a
  posição ao skeleton (carregamento.css), e é por ela que o legado descarta os
  quadros ao sair da conta e ao atualizar os dados (`clearExternalPanelCache`,
  `refreshData`) — o de análises vai junto e renasce na próxima abertura.
*/
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../componentes/dados-do-monitoramento.js";
import { enderecoDasAnalises } from "../lib/pagina-de-analises.js";
import { acompanharCarregamentoDoPainel } from "./carregamento.js";

const CLASSE_DO_QUADRO = "quadro-das-analises";
const vigiadas = new WeakSet();

const texto = (valor) => String(valor ?? "").trim();
const quadroDa = (pagina) =>
  pagina.querySelector(`:scope > .${CLASSE_DO_QUADRO}`);

function criarQuadro(pagina, area, origem) {
  const quadro = document.createElement("div");
  quadro.className = `external-panel ${CLASSE_DO_QUADRO}`;
  quadro.dataset.area = area;
  const frame = document.createElement("iframe");
  frame.className = "external-frame";
  frame.title = "Análises curriculares";
  frame.src = enderecoDasAnalises(origem, area);
  frame.loading = "eager";
  frame.allow = "fullscreen; clipboard-read; clipboard-write";
  frame.allowFullscreen = true;
  quadro.append(frame);
  pagina.append(quadro);
  acompanharCarregamentoDoPainel(quadro, {
    aoTentarDeNovo: () => recarregarPaginaDeAnalises(pagina, { origem }),
  });
  return quadro;
}

/* Com a página aberta, trocar de área refaz o quadro com a área nova. */
function vigiarAArea(pagina, origem) {
  if (vigiadas.has(pagina)) return;
  vigiadas.add(pagina);
  assinarDadosDoMonitoramento(() => {
    const quadro = quadroDa(pagina);
    if (!quadro || !pagina.classList.contains("active")) return;
    if (quadro.dataset.area === texto(obterDadosDoMonitoramento().areaAtual))
      return;
    abrirPaginaDeAnalises(pagina, { origem });
  });
}

/**
 * Mostra o quadro da área atual na página: cria na primeira vez, refaz se a
 * área mudou e, na mesma área, deixa como está. Devolve o quadro.
 */
export function abrirPaginaDeAnalises(
  pagina,
  { origem = window.location.origin } = {},
) {
  if (!pagina) return null;
  vigiarAArea(pagina, origem);
  const area = texto(obterDadosDoMonitoramento().areaAtual);
  const atual = quadroDa(pagina);
  if (atual && atual.dataset.area === area) return atual;
  atual?.remove();
  return criarQuadro(pagina, area, origem);
}

/** O "Tentar novamente" do aviso de demora: o quadro recomeça do zero. */
export function recarregarPaginaDeAnalises(pagina, opcoes) {
  if (!pagina) return null;
  quadroDa(pagina)?.remove();
  return abrirPaginaDeAnalises(pagina, opcoes);
}

/** O iframe aberto, para a tela cheia do legado. */
export function quadroDasAnalises(pagina) {
  return pagina ? quadroDa(pagina)?.querySelector("iframe") || null : null;
}
