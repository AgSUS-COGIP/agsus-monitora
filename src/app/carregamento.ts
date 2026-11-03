/*
  Carregamento sem tela de carregamento.

  Entrada: o skeleton (`.esqueleto-da-entrada`, no index.html) mostra o formato
  do sistema enquanto a sessão e os dados chegam, no lugar do antigo cartão
  com etapas e percentual. A marcação está no HTML para sair na primeira
  pintura; quando há sessão guardada, o script `marcarSessaoGuardada` do
  <head> o liga antes de qualquer JavaScript do bundle. Daí em diante, quem
  liga e desliga é o app (src/app/sistema.ts e carga.ts), por
  `mostrarEsqueleto` e `esconderEsqueleto`.
  Na demora, nos mesmos tempos da antiga tela (`getLoadingStage`, em
  `lib/loading-copy.ts`), aparece um aviso e, depois, "Tentar novamente".

  Painel externo: a cobertura com o que está carregando é do módulo
  src/modulos/paineis-externos/carregamento-do-painel.tsx.

  Atualizar dados: a tela fica como está e uma barra fina corre no pé do
  cabeçalho (`marcarAtualizacao`), até os dados novos a substituírem.
*/
import { formatoDoEsqueleto } from "../lib/esqueleto-da-entrada";
import { getLoadingStage } from "../lib/loading-copy";

const ATIVO = "esqueleto-ativo";
const MARCOS_DE_DEMORA_MS = [12_000, 25_000];

let inicio = 0;
let temporizadores: number[] = [];

const raiz = () => document.documentElement;
const avisoDaEntrada = () =>
  document.querySelector<HTMLElement>(".esqueleto-da-entrada .esqueleto-aviso");

export function esqueletoAtivo() {
  return raiz().classList.contains(ATIVO);
}

/** Aviso de demora de um skeleton: some antes dos 12s, oferece tentar aos 25s. */
function avisar(aviso: HTMLElement | null, decorridoMs: number) {
  if (!aviso) return;
  const etapa = getLoadingStage({ elapsedMs: decorridoMs });
  aviso.querySelector("p")!.textContent = etapa.delayMessage;
  aviso.querySelector("button")!.hidden = !etapa.canRetry;
  aviso.hidden = !etapa.delayed;
}

/** Agenda os avisos de demora desde `desde` (`performance.now()`). */
function agendarAvisos(aviso: HTMLElement | null, desde: number) {
  const decorrido = performance.now() - desde;
  avisar(aviso, decorrido);
  return MARCOS_DE_DEMORA_MS.filter((ms) => ms > decorrido).map((ms) =>
    window.setTimeout(
      () => avisar(aviso, performance.now() - desde),
      ms - decorrido,
    ),
  );
}

function acompanharDemora(desde: number) {
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
export function mostrarEsqueleto(visao: unknown) {
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
export function marcarAtualizacao(ativa: boolean) {
  raiz().classList.toggle("dados-atualizando", !!ativa);
}

/**
 * Chamado pelo `main.ts`. Liga o botão "Tentar novamente" e, se o script do
 * <head> já ligou o skeleton, conta a demora desde o início da navegação.
 */
export function instalarCarregamento() {
  avisoDaEntrada()
    ?.querySelector("button")
    ?.addEventListener("click", () => window.location.reload());
  if (esqueletoAtivo()) acompanharDemora(0);
}
