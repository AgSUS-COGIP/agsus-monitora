/*
  Carregamento do painel de análises sem tela de carregamento.

  No lugar da antiga janela "Carregando análises", o próprio painel vira o
  skeleton (mesmo desenho do #131, `src/styles/carregamento.css`): a faixa de
  filtros ainda vazia, os 7 cartões de KPI, os gráficos, as pendências e as
  linhas da fila pulsam no tamanho e na posição do conteúdo real, e a tela não
  "pula" quando os dados chegam. O CSS mora em `analises-esqueleto.css`.

  - Primeira carga: a fila e as pendências ainda estão vazias; entram linhas de
    marcação (`data-esqueleto`) com a mesma estrutura das reais, que saem
    quando o painel desenha os dados (ou no fim do carregamento).
  - Recarga (Atualizar, troca de Situação do processo): só as partes que mudam
    pulsam — KPIs, gráficos, pendências e fila; os filtros já preenchidos
    ficam como estão. Trocar filtro que só recalcula no navegador não liga
    nada: quem liga é `definirCarregamentoDoPainel`, chamado pelo
    `showLoading` do analises-app.js só quando busca dados.
  - Demora: nos tempos do #131 (`getLoadingStage`), um aviso discreto e, depois,
    "Tentar novamente". Erro: o aviso com a mensagem e "Tentar novamente".
  - Dentro do MONITORA (iframe), avisa o app principal
    (docs/painel-externo-avisa-que-carregou.md): `agsus:painel-carregando` ao
    começar e `agsus:painel-pronto` quando os dados (ou o erro) estão na tela,
    para o skeleton de lá cobrir o quadro até aqui.

  `#loading` continua existindo, escondido na tela: é a região que o leitor de
  tela anuncia (etapas do `setProgress`) e o sinal que outros módulos leem
  (`#loading.show`).
*/
import { getLoadingStage } from "../lib/loading-copy.js";

export const CLASSE_CARREGANDO = "analises-is-loading";
export const AVISO_DO_PAINEL_CARREGANDO = "agsus:painel-carregando";
export const AVISO_DO_PAINEL_PRONTO = "agsus:painel-pronto";
const MARCOS_DE_DEMORA_MS = [12_000, 25_000];
const LINHAS_DA_FILA = 8;
const ITENS_DE_PENDENCIA = 4;
const BOTOES_OCUPADOS = ["refreshBtn", "applyBtn"];

const estado = {
  ativo: false,
  inicio: 0,
  temporizadores: [],
  avisouPronto: false,
  /* Um erro na tela fica até o "Tentar novamente" ou a próxima carga. */
  erro: false,
};

function avisarMonitora(tipo) {
  try {
    if (window.top && window.top !== window)
      window.top.postMessage({ tipo }, "*");
  } catch {
    /* Aberto sozinho ou sem acesso ao topo: o aviso não tem efeito. */
  }
}

function avisarQueFicouPronto() {
  if (estado.avisouPronto) return;
  estado.avisouPronto = true;
  avisarMonitora(AVISO_DO_PAINEL_PRONTO);
}

function marcarBotao(botao, ocupado) {
  if (!botao) return;
  botao.setAttribute("aria-busy", String(ocupado));
  if (ocupado) {
    if (botao.dataset.loadingPreviouslyDisabled === undefined)
      botao.dataset.loadingPreviouslyDisabled = String(botao.disabled);
    botao.disabled = true;
    return;
  }
  if (botao.dataset.loadingPreviouslyDisabled === undefined) return;
  botao.disabled = botao.dataset.loadingPreviouslyDisabled === "true";
  delete botao.dataset.loadingPreviouslyDisabled;
}

const celula = (conteudo = "&nbsp;") => `<td>${conteudo}</td>`;
const celulaDupla = () =>
  celula(
    '<div class="primary-text">&nbsp;</div><span class="secondary-text">&nbsp;</span>',
  );

/* Uma linha da fila com a mesma estrutura da real (vaga e candidato em duas linhas). */
function linhaDaFila() {
  return `<tr data-esqueleto="true" aria-hidden="true">${celula()}${celula()}${celula()}${celula()}${celulaDupla()}${celulaDupla()}${celula('<span class="badge neutro">&nbsp;</span>')}${celula('<span class="btn secondary small">&nbsp;</span>')}</tr>`;
}

const itemDePendencia = () =>
  '<div class="attention-item" data-esqueleto="true" aria-hidden="true"><b>&nbsp;</b><small>&nbsp;</small></div>';

/* Primeira carga: fila e pendências vazias ganham as linhas de marcação. */
function preencherVazios() {
  const fila = document.getElementById("tableBody");
  if (fila && !fila.querySelector("tr:not([data-esqueleto])"))
    fila.innerHTML = Array.from({ length: LINHAS_DA_FILA }, linhaDaFila).join(
      "",
    );
  const pendencias = document.getElementById("attentionList");
  if (pendencias && !pendencias.children.length)
    pendencias.innerHTML = Array.from(
      { length: ITENS_DE_PENDENCIA },
      itemDePendencia,
    ).join("");
}

function tirarMarcacoes() {
  document
    .querySelectorAll(
      "#tableBody [data-esqueleto], #attentionList [data-esqueleto]",
    )
    .forEach((elemento) => elemento.remove());
}

function avisoDoCarregamento() {
  let aviso = document.getElementById("analisesAvisoDoCarregamento");
  if (aviso) return aviso;
  aviso = document.createElement("div");
  aviso.id = "analisesAvisoDoCarregamento";
  aviso.className = "analises-aviso-do-carregamento";
  aviso.setAttribute("role", "status");
  aviso.setAttribute("aria-live", "polite");
  aviso.hidden = true;
  const texto = document.createElement("p");
  const tentar = document.createElement("button");
  tentar.type = "button";
  tentar.className = "btn secondary small";
  tentar.textContent = "Tentar novamente";
  tentar.hidden = true;
  tentar.addEventListener("click", () => {
    const acao = aviso.aoTentarDeNovo;
    estado.erro = false;
    aviso.hidden = true;
    if (typeof acao === "function") acao();
    else window.location.reload();
  });
  aviso.append(texto, tentar);
  document.body.appendChild(aviso);
  return aviso;
}

function mostrarAviso(mensagem, podeTentar, aoTentarDeNovo = null) {
  const aviso = avisoDoCarregamento();
  aviso.querySelector("p").textContent = mensagem;
  aviso.querySelector("button").hidden = !podeTentar;
  aviso.aoTentarDeNovo = aoTentarDeNovo;
  aviso.hidden = !mensagem;
}

function esconderAviso() {
  const aviso = document.getElementById("analisesAvisoDoCarregamento");
  if (aviso) aviso.hidden = true;
}

function avisarDemora() {
  const etapa = getLoadingStage({
    elapsedMs: performance.now() - estado.inicio,
  });
  if (etapa.delayed) mostrarAviso(etapa.delayMessage, etapa.canRetry);
}

function pararDeContar() {
  estado.temporizadores.forEach((id) => window.clearTimeout(id));
  estado.temporizadores = [];
}

function ligar() {
  document.body.classList.add(CLASSE_CARREGANDO);
  document.querySelector("main.content")?.setAttribute("aria-busy", "true");
  BOTOES_OCUPADOS.forEach((id) =>
    marcarBotao(document.getElementById(id), true),
  );
  preencherVazios();
  if (estado.ativo) return;
  estado.erro = false;
  esconderAviso();
  estado.ativo = true;
  estado.inicio = performance.now();
  pararDeContar();
  estado.temporizadores = MARCOS_DE_DEMORA_MS.map((ms) =>
    window.setTimeout(avisarDemora, ms),
  );
}

function desligar() {
  estado.ativo = false;
  pararDeContar();
  document.body.classList.remove(CLASSE_CARREGANDO);
  document.querySelector("main.content")?.setAttribute("aria-busy", "false");
  BOTOES_OCUPADOS.forEach((id) =>
    marcarBotao(document.getElementById(id), false),
  );
  tirarMarcacoes();
  if (!estado.erro) esconderAviso();
  avisarQueFicouPronto();
}

/** Liga ou desliga o skeleton do painel (o `showLoading` do analises-app.js). */
export function definirCarregamentoDoPainel(ativo) {
  document
    .getElementById("loading")
    ?.setAttribute("aria-hidden", String(!ativo));
  if (ativo) ligar();
  else desligar();
}

/**
 * Falha ao carregar: tira o skeleton e mostra a mensagem com "Tentar
 * novamente" (sem `aoTentarDeNovo`, recarrega a página).
 */
export function mostrarErroDoCarregamento(mensagem, aoTentarDeNovo = null) {
  desligar();
  estado.erro = true;
  mostrarAviso(
    String(mensagem || "Não foi possível carregar o painel."),
    true,
    aoTentarDeNovo,
  );
}

avisarMonitora(AVISO_DO_PAINEL_CARREGANDO);
