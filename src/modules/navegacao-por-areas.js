import { escapeAttr, escapeHtml } from "../lib/sanitize.js";
import { grupoAberto } from "../lib/areas-da-navegacao.js";
import { setaDoGrupo } from "../lib/icones-da-navegacao.js";

/*
  Grupos recolhíveis da barra lateral.

  O HTML de cada botão continua saindo de `navButton` em `legacy-app.js`, porque
  `navigate`, `setActiveNav`, a barra inferior do celular e o submenu de
  Configurações dependem dele. Este módulo só embrulha os botões num grupo com
  cabeçalho clicável e lembra quais grupos a pessoa deixou fechados.

  Com a barra recolhida (68px) os cabeçalhos somem e todos os ícones aparecem,
  inclusive os de grupos fechados: recolher a barra não pode esconder destino.
  Essa regra mora em `navegacao-por-areas.css`.
*/

export const CHAVE_DOS_GRUPOS = "agsus_monitora_nav_grupos_v1";

export function lerEstadoDosGrupos(armazenamento = globalThis.localStorage) {
  try {
    const salvo = JSON.parse(armazenamento?.getItem(CHAVE_DOS_GRUPOS) || "{}");
    return salvo && typeof salvo === "object" ? salvo : {};
  } catch {
    return {};
  }
}

function salvarEstadoDoGrupo(id, aberto, armazenamento) {
  try {
    const estado = lerEstadoDosGrupos(armazenamento);
    estado[id] = aberto;
    armazenamento?.setItem(CHAVE_DOS_GRUPOS, JSON.stringify(estado));
  } catch {
    // Sem armazenamento (aba privada, cota cheia): o grupo abre e fecha, só não é lembrado.
  }
}

export function htmlDaNavegacaoPorAreas(
  grupos,
  { botao, estadoSalvo = {}, viewAtiva = "" },
) {
  return grupos
    .map((grupo) => {
      const aberto = grupoAberto(grupo, { estadoSalvo, viewAtiva });
      const idItens = "navGrupo-" + grupo.id;
      const itens = grupo.itens
        .map((item) => botao(item.view, item.rotulo, item.icone))
        .join("");
      return (
        `<section class="nav-group nav-grupo" data-nav-grupo="${escapeAttr(grupo.id)}" data-aberto="${aberto}">` +
        `<p class="nav-grupo__cabecalho"><button type="button" class="nav-grupo__alternar" aria-expanded="${aberto}" aria-controls="${escapeAttr(idItens)}">` +
        `<span class="nav-grupo__titulo">${escapeHtml(grupo.titulo)}</span>` +
        setaDoGrupo() +
        `</button></p>` +
        `<div id="${escapeAttr(idItens)}" class="nav-grupo__itens">${itens}</div>` +
        `</section>`
      );
    })
    .join("");
}

function definirAberto(secao, aberto) {
  secao.dataset.aberto = String(aberto);
  secao
    .querySelector(".nav-grupo__alternar")
    ?.setAttribute("aria-expanded", String(aberto));
}

/*
  Ao navegar para uma tela cujo grupo está fechado (pela barra inferior do
  celular, pelo histórico ou pela Aya), o grupo abre para o item ativo ficar
  visível. Não grava: foi o sistema que abriu, não a pessoa.
*/
export function abrirGrupoDaView(documento, view) {
  const botao = [
    ...(documento
      .getElementById("nav")
      ?.querySelectorAll("button[data-view]") || []),
  ].find((b) => b.dataset.view === view);
  const secao = botao?.closest(".nav-grupo");
  if (secao && secao.dataset.aberto !== "true") definirAberto(secao, true);
}

export function instalarNavegacaoPorAreas(
  documento = globalThis.document,
  armazenamento = globalThis.localStorage,
) {
  const nav = documento?.getElementById?.("nav");
  if (!nav || nav.dataset.gruposInstalados === "1") return;
  nav.dataset.gruposInstalados = "1";
  nav.addEventListener("click", (evento) => {
    const alternar = evento.target.closest(".nav-grupo__alternar");
    if (!alternar || !nav.contains(alternar)) return;
    const secao = alternar.closest(".nav-grupo");
    const aberto = secao.dataset.aberto !== "true";
    definirAberto(secao, aberto);
    salvarEstadoDoGrupo(secao.dataset.navGrupo, aberto, armazenamento);
  });
}
