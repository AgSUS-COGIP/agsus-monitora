/*
  As páginas que são um painel do app num quadro: Análises curriculares
  (`#page-analises`, view `analises`), Entrevistas (`#page-entrevistas`,
  view `entrevistas`) e Recursos dos candidatos (`#page-recursos`, view
  `recursos`).

  A seção diz qual painel é (`data-painel="analises" | "entrevistas" |
  "recursos"`); o
  endereço e o título do quadro vêm de `PAGINAS_DO_PAINEL`
  (src/lib/pagina-do-painel.js), com a área atual do menu na URL (`?area=`).
  O comportamento é o que Análises herdou do antigo painel externo
  (`openPanel` do legado):

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
  `refreshData`) — o quadro vai junto e renasce na próxima abertura.
*/
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../componentes/dados-do-monitoramento.js";
import {
  enderecoDaPaginaDoPainel,
  PAGINAS_DO_PAINEL,
} from "../lib/pagina-do-painel.js";
import { acompanharCarregamentoDoPainel } from "./carregamento.js";

const CLASSE_DO_QUADRO = "quadro-do-painel";
const vigiadas = new WeakSet();

const texto = (valor) => String(valor ?? "").trim();
const quadroDa = (pagina) =>
  pagina.querySelector(`:scope > .${CLASSE_DO_QUADRO}`);
const painelDa = (pagina) => PAGINAS_DO_PAINEL[pagina.dataset.painel] || null;

function criarQuadro(pagina, area, origem) {
  const quadro = document.createElement("div");
  quadro.className = `external-panel ${CLASSE_DO_QUADRO}`;
  quadro.dataset.area = area;
  const frame = document.createElement("iframe");
  frame.className = "external-frame";
  frame.title = painelDa(pagina).titulo;
  frame.src = enderecoDaPaginaDoPainel(pagina.dataset.painel, origem, area);
  frame.loading = "eager";
  frame.allow = "fullscreen; clipboard-read; clipboard-write";
  frame.allowFullscreen = true;
  quadro.append(frame);
  pagina.append(quadro);
  acompanharCarregamentoDoPainel(quadro, {
    aoTentarDeNovo: () => recarregarPaginaDoPainel(pagina, { origem }),
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
    abrirPaginaDoPainel(pagina, { origem });
  });
}

/**
 * Mostra o quadro da área atual na página: cria na primeira vez, refaz se a
 * área mudou e, na mesma área, deixa como está. Devolve o quadro (ou `null`,
 * se a seção não diz um painel conhecido).
 */
export function abrirPaginaDoPainel(
  pagina,
  { origem = window.location.origin } = {},
) {
  if (!pagina || !painelDa(pagina)) return null;
  vigiarAArea(pagina, origem);
  const area = texto(obterDadosDoMonitoramento().areaAtual);
  const atual = quadroDa(pagina);
  if (atual && atual.dataset.area === area) return atual;
  atual?.remove();
  return criarQuadro(pagina, area, origem);
}

/** O "Tentar novamente" do aviso de demora: o quadro recomeça do zero. */
export function recarregarPaginaDoPainel(pagina, opcoes) {
  if (!pagina) return null;
  quadroDa(pagina)?.remove();
  return abrirPaginaDoPainel(pagina, opcoes);
}

/** O iframe aberto, para a tela cheia do legado. */
export function quadroDoPainel(pagina) {
  return pagina ? quadroDa(pagina)?.querySelector("iframe") || null : null;
}
