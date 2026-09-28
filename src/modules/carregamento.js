/*
  Carregamento sem tela de carregamento.

  Entrada: o skeleton (`.esqueleto-da-entrada`, no index.html) mostra o formato
  do sistema enquanto a sessão e os dados chegam, no lugar do antigo cartão
  com etapas e percentual. A marcação está no HTML para sair na primeira
  pintura; quando há sessão guardada, o script `marcarSessaoGuardada` do
  <head> o liga antes de qualquer JavaScript do bundle. Daí em diante, quem
  liga e desliga é o legado, por `mostrarEsqueleto` e `esconderEsqueleto`.
  Na demora, nos mesmos tempos da antiga tela (`getLoadingStage`, em
  `lib/loading-copy.js`), aparece um aviso e, depois, "Tentar novamente".

  Painel externo: o iframe nasce na primeira abertura e fica em branco até o
  site de fora responder. Um skeleton de painel de indicadores cobre o quadro
  até o `load` do iframe, ou até o painel avisar que ficou pronto
  (`acompanharCarregamentoDoPainel`), com o mesmo aviso de demora.

  Atualizar dados: a tela fica como está e uma barra fina corre no pé do
  cabeçalho (`marcarAtualizacao`), até os dados novos a substituírem.
*/
import { formatoDoEsqueleto } from "../lib/esqueleto-da-entrada.js";
import { getLoadingStage } from "../lib/loading-copy.js";

const ATIVO = "esqueleto-ativo";
const MARCOS_DE_DEMORA_MS = [12_000, 25_000];

let inicio = 0;
let temporizadores = [];

const raiz = () => document.documentElement;
const avisoDaEntrada = () =>
  document.querySelector(".esqueleto-da-entrada .esqueleto-aviso");

export function esqueletoAtivo() {
  return raiz().classList.contains(ATIVO);
}

/** Aviso de demora de um skeleton: some antes dos 12s, oferece tentar aos 25s. */
function avisar(aviso, decorridoMs) {
  if (!aviso) return;
  const etapa = getLoadingStage({ elapsedMs: decorridoMs });
  aviso.querySelector("p").textContent = etapa.delayMessage;
  aviso.querySelector("button").hidden = !etapa.canRetry;
  aviso.hidden = !etapa.delayed;
}

/** Agenda os avisos de demora desde `desde` (`performance.now()`). */
function agendarAvisos(aviso, desde) {
  const decorrido = performance.now() - desde;
  avisar(aviso, decorrido);
  return MARCOS_DE_DEMORA_MS.filter((ms) => ms > decorrido).map((ms) =>
    window.setTimeout(
      () => avisar(aviso, performance.now() - desde),
      ms - decorrido,
    ),
  );
}

function acompanharDemora(desde) {
  pararDeAcompanhar();
  inicio = desde;
  temporizadores = agendarAvisos(avisoDaEntrada(), inicio);
}

function pararDeAcompanhar() {
  temporizadores.forEach((id) => window.clearTimeout(id));
  temporizadores = [];
  avisar(avisoDaEntrada(), 0);
}

/**
 * Liga o skeleton no formato da tela que vai abrir. Se já estava ligado (pelo
 * script do <head> ou por uma etapa anterior), só atualiza o formato: a
 * contagem da demora continua de onde estava.
 */
export function mostrarEsqueleto(visao) {
  const html = raiz();
  html.dataset.esqueleto = formatoDoEsqueleto(visao);
  html.dataset.esqueletoBarra = document.body.classList.contains(
    "sidebar-collapsed",
  )
    ? "recolhida"
    : "aberta";
  const jaLigado = esqueletoAtivo();
  html.classList.add(ATIVO);
  if (!jaLigado) acompanharDemora(performance.now());
}

export function esconderEsqueleto() {
  raiz().classList.remove(ATIVO);
  pararDeAcompanhar();
}

/** Barra de atualização no cabeçalho, enquanto os dados da tela são trocados. */
export function marcarAtualizacao(ativa) {
  raiz().classList.toggle("dados-atualizando", !!ativa);
}

function elemento(tag, classe, filhos = []) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  el.append(...filhos);
  return el;
}

const bloco = (modificador) =>
  elemento("span", `esqueleto esqueleto--${modificador}`);

/** Um painel de indicadores genérico: título, quatro indicadores e dois gráficos. */
function criarEsqueletoDoPainel() {
  const indicador = () =>
    elemento("div", "esqueleto-cartao esqueleto-cartao--kpi", [
      bloco("icone"),
      bloco("numero"),
    ]);
  const grafico = () =>
    elemento("div", "esqueleto-cartao", [bloco("sobretitulo"), bloco("area")]);
  const conteudo = elemento("div", "esqueleto-do-painel__conteudo", [
    elemento("div", "esqueleto-do-painel__topo", [
      bloco("titulo"),
      bloco("linha"),
    ]),
    elemento("div", "esqueleto-do-painel__kpis", [
      indicador(),
      indicador(),
      indicador(),
      indicador(),
    ]),
    elemento("div", "esqueleto-do-painel__graficos", [grafico(), grafico()]),
  ]);
  conteudo.setAttribute("aria-hidden", "true");
  const rotulo = elemento("span", "sr-only");
  rotulo.textContent = "Carregando o painel…";
  const texto = elemento("p");
  const tentar = elemento("button", "btn secondary");
  tentar.type = "button";
  tentar.textContent = "Tentar novamente";
  tentar.hidden = true;
  const aviso = elemento("div", "esqueleto-aviso", [texto, tentar]);
  aviso.hidden = true;
  const esqueleto = elemento("div", "esqueleto-do-painel", [
    rotulo,
    conteudo,
    aviso,
  ]);
  esqueleto.setAttribute("role", "status");
  return esqueleto;
}

/*
  Painel que avisa quando fica pronto (docs/painel-externo-avisa-que-carregou.md).

  O `load` do iframe diz que a página chegou, não que os dados chegaram. Um
  Apps Script, por exemplo, abre a página e só depois busca os dados, com o
  carregamento dele. Quem manda `agsus:painel-carregando` ao começar mantém o
  skeleton até mandar `agsus:painel-pronto`. Quem não manda nada sai no
  `load`, como antes, só com uma folga curta: o primeiro aviso pode chegar
  logo depois do `load`. `ESPERA_MAXIMA_MS` tira o skeleton de qualquer jeito,
  para um painel que avisou e travou não ficar coberto para sempre.
*/
export const AVISO_DO_PAINEL_CARREGANDO = "agsus:painel-carregando";
export const AVISO_DO_PAINEL_PRONTO = "agsus:painel-pronto";
const FOLGA_DO_AVISO_MS = 300;
const ESPERA_MAXIMA_MS = 45_000;

/*
  A mensagem veio deste iframe? O Apps Script roda num iframe dentro do
  iframe, então a janela que manda pode estar alguns níveis abaixo. `parent`
  se lê mesmo entre origens diferentes.
*/
function veioDoQuadro(janela, quadro) {
  for (let nivel = 0; janela && nivel < 4; nivel += 1) {
    if (janela === quadro.contentWindow) return true;
    if (janela === janela.parent) return false;
    janela = janela.parent;
  }
  return false;
}

/**
 * Cobre o iframe do painel com um skeleton até ele carregar, ou até avisar que
 * ficou pronto. `aoTentarDeNovo` é o "Tentar novamente" do aviso de demora
 * (no legado, `reloadExternal`).
 */
export function acompanharCarregamentoDoPainel(
  holder,
  { aoTentarDeNovo } = {},
) {
  const quadro = holder?.querySelector("iframe");
  if (!quadro) return;
  const esqueleto = criarEsqueletoDoPainel();
  const aviso = esqueleto.querySelector(".esqueleto-aviso");
  aviso
    .querySelector("button")
    .addEventListener("click", () => aoTentarDeNovo?.());
  holder.append(esqueleto);
  const temporizadores = agendarAvisos(aviso, performance.now());
  let anunciou = false;
  let saiu = false;

  function sair() {
    if (saiu) return;
    saiu = true;
    window.removeEventListener("message", ouvir);
    temporizadores.forEach((id) => window.clearTimeout(id));
    esqueleto.classList.add("esqueleto-do-painel--saindo");
    window.setTimeout(() => esqueleto.remove(), 200);
  }

  function ouvir(evento) {
    const tipo = evento.data?.tipo;
    if (tipo !== AVISO_DO_PAINEL_CARREGANDO && tipo !== AVISO_DO_PAINEL_PRONTO)
      return;
    if (!veioDoQuadro(evento.source, quadro)) return;
    if (tipo === AVISO_DO_PAINEL_PRONTO) sair();
    else anunciou = true;
  }

  window.addEventListener("message", ouvir);
  temporizadores.push(window.setTimeout(sair, ESPERA_MAXIMA_MS));
  quadro.addEventListener(
    "load",
    () =>
      temporizadores.push(
        window.setTimeout(() => {
          if (!anunciou) sair();
        }, FOLGA_DO_AVISO_MS),
      ),
    { once: true },
  );
}

/**
 * Chamado pelo `main.js`. Liga o botão "Tentar novamente" e, se o script do
 * <head> já ligou o skeleton, conta a demora desde o início da navegação.
 */
export function instalarCarregamento() {
  avisoDaEntrada()
    ?.querySelector("button")
    ?.addEventListener("click", () => window.location.reload());
  if (esqueletoAtivo()) acompanharDemora(0);
}
