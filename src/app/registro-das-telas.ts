import type { ReactNode } from "react";
import { comecarCargaDeTela } from "../lib/carga-de-telas";
import { importarComRecarga } from "../lib/importar-com-recarga";
import type { criarAnalises } from "../modulos/analises/analises.tsx";
import type { criarListaAprovados } from "../modulos/aprovados/lista-aprovados.tsx";
import type { criarAvaliacaoDocumental } from "../modulos/avaliacao-documental/avaliacao-documental.tsx";
import type { criarPreClassificacao } from "../modulos/avaliacao-documental/entrada-da-pre-classificacao.tsx";
import type { criarClassificacao } from "../modulos/classificacao/classificacao.tsx";
import type { criarCalendarioEditais } from "../modulos/cronograma/calendario-editais.tsx";
import type { criarNucleo } from "../modulos/editais/nucleo.tsx";
import type { criarConducaoDeEntrevistas } from "../modulos/entrevistas/conduzir.tsx";
import type { criarEntrevistas } from "../modulos/entrevistas/entrevistas.tsx";
import type { criarRecursos } from "../modulos/recursos/recursos.tsx";
import type { criarSelecao } from "../modulos/selecao/selecao.tsx";
import type { criarVisaoGeral } from "../modulos/visao-geral/visao-geral.tsx";
import type { criarConfiguracoes } from "../modulos/configuracoes/configuracoes.tsx";
import type { criarAcessos } from "../modulos/acessos/acessos.tsx";
import type { criarModulos } from "../modulos/modulos/modulos.tsx";
import type { criarSaudeDasCargas } from "../componentes/saude-das-cargas/saude-das-cargas.tsx";
import type { criarAutomacao } from "../modulos/automacao/automacao.tsx";

/*
  O registro das telas do app: quem precisa de outra tela (o "Ir para…" com
  edital, o "Lista de aprovados" de Editais, a linha do tempo da Visão geral)
  pede aqui o controlador dela, em vez de `window.<tela>Controller`. Sem React
  e sem importar as telas (só os tipos): quem registra é src/app/telas.tsx.

  O controlador é o que `criarX` devolve (estado, conteúdo React, `render()`
  a cada abertura, `abrirVisao`/`abrirEdital` quando a tela tem). Cada tela é
  criada uma vez por página aberta: as visitadas continuam montadas.

  Configurações também está aqui: a moldura (`config`) e as seções que são
  telas próprias (`secao:<id>`: Acessos, Módulos e abas, Status das
  atualizações e Automação), cada uma no seu pacote. A navegação pergunta a
  elas antes de sair (`confirmarSaidaDasSecoes`).

  Tela sob demanda baixa na primeira vez que alguém pede (a rota, a
  pré-carga do menu ou outra tela). A falha não fica guardada: o próximo
  pedido tenta de novo. Versão nova publicada com a página aberta: o import
  recarrega a página uma vez (importarComRecarga).
*/

/** O mínimo de toda tela: o conteúdo e o que se chama ao abrir. */
export interface ControladorDeTela {
  /** O componente da tela (com o estado dela), desenhado pela rota. */
  readonly conteudo: ReactNode;
  /** Como a tela aparece no console se quebrar ("a tela de seleção"). */
  readonly nome: string;
  render(): unknown;
  abrirVisao?(visao: string): unknown;
  abrirEdital?(edital: string): unknown;
}

/** O controlador de cada tela, pelo nome interno (view). */
export interface ControladoresDasTelas {
  dashboard: ReturnType<typeof criarVisaoGeral>;
  nucleo: ReturnType<typeof criarNucleo>;
  calendario: ReturnType<typeof criarCalendarioEditais>;
  approved: ReturnType<typeof criarListaAprovados>;
  recursos: ReturnType<typeof criarRecursos>;
  "analisar-recursos": ReturnType<typeof criarRecursos>;
  entrevistas: ReturnType<typeof criarEntrevistas>;
  "conduzir-entrevistas": ReturnType<typeof criarConducaoDeEntrevistas>;
  classificacao: ReturnType<typeof criarClassificacao>;
  analises: ReturnType<typeof criarAnalises>;
  "avaliacao-documental": ReturnType<typeof criarAvaliacaoDocumental>;
  "pre-classificacao": ReturnType<typeof criarPreClassificacao>;
  selecao: ReturnType<typeof criarSelecao>;
  config: ReturnType<typeof criarConfiguracoes>;
  "secao:acessos": ReturnType<typeof criarAcessos>;
  "secao:modulos": ReturnType<typeof criarModulos>;
  "secao:cargas": ReturnType<typeof criarSaudeDasCargas>;
  "secao:automacao": ReturnType<typeof criarAutomacao>;
}

export type ViewDeTela = keyof ControladoresDasTelas;

/** As seções de Configurações que são telas próprias. */
export const SECOES_COM_TELA = Object.freeze([
  "acessos",
  "modulos",
  "cargas",
  "automacao",
] as const);
export type SecaoComTela = (typeof SECOES_COM_TELA)[number];

export const ehSecaoComTela = (secao: string): secao is SecaoComTela =>
  (SECOES_COM_TELA as readonly string[]).includes(secao);

/** A view da seção no registro (`secao:acessos`…). */
export const viewDaSecao = (secao: SecaoComTela) =>
  `secao:${secao}` as const satisfies ViewDeTela;

/**
 * Como a tela nasce: `criar` (no pacote principal, na hora) ou `carregar`
 * (sob demanda, por `import()`).
 */
export type FonteDaTela<V extends ViewDeTela = ViewDeTela> =
  | { criar: () => ControladoresDasTelas[V]; carregar?: never }
  | { carregar: () => Promise<ControladoresDasTelas[V]>; criar?: never };

type Fontes = { [V in ViewDeTela]?: FonteDaTela<V> };

let fontes: Fontes = {};
const prontas = new Map<ViewDeTela, ControladorDeTela>();
const pedidos = new Map<ViewDeTela, Promise<ControladorDeTela>>();

/*
  Quem desenha as telas (src/app/telas.tsx) acompanha as criadas: tela
  baixada por outra (o modal da Lista de aprovados aberto em Editais) monta
  escondida, como a visitada.
*/
let versao = 0;
const ouvintes = new Set<() => void>();
function guardar(view: ViewDeTela, controlador: ControladorDeTela) {
  prontas.set(view, controlador);
  versao += 1;
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function assinarTelas(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Muda a cada tela criada (para `useSyncExternalStore`). */
export const versaoDasTelas = (): number => versao;

/** A tela já foi criada (está ou pode estar montada)? */
export const telaCriada = (view: string): boolean =>
  prontas.has(view as ViewDeTela);

/** As telas do app (src/app/telas.tsx); chamar de novo troca o registro (testes). */
export function registrarTelas(novas: Fontes): void {
  fontes = { ...novas };
  prontas.clear();
  pedidos.clear();
  versao += 1;
  ouvintes.forEach((ouvinte) => ouvinte());
}

export const ehTelaRegistrada = (view: string): view is ViewDeTela =>
  Object.hasOwn(fontes, view);

/** A tela vem no pacote principal (sem `import()`)? */
export const telaNaHora = (view: ViewDeTela): boolean =>
  typeof fontes[view]?.criar === "function";

/** O controlador já criado (ou o da tela do pacote principal, criado agora). */
export function telaPronta<V extends ViewDeTela>(
  view: V,
): ControladoresDasTelas[V] | undefined {
  const pronta = prontas.get(view);
  if (pronta) return pronta as ControladoresDasTelas[V];
  const fonte = fontes[view] as FonteDaTela<V> | undefined;
  if (!fonte?.criar) return undefined;
  const criada = fonte.criar();
  // Sem avisar: quem pede a tela na hora é o próprio desenho dela.
  prontas.set(view, criada);
  return criada;
}

/** O controlador da tela, baixando e criando na primeira vez. */
export function carregarTela<V extends ViewDeTela>(
  view: V,
): Promise<ControladoresDasTelas[V]> {
  const pronta = telaPronta(view);
  if (pronta) return Promise.resolve(pronta);
  const fonte = fontes[view] as FonteDaTela<V> | undefined;
  if (!fonte?.carregar)
    return Promise.reject(new Error(`A tela "${view}" não está registrada.`));
  let pedido = pedidos.get(view) as
    Promise<ControladoresDasTelas[V]> | undefined;
  if (!pedido) {
    const terminar = comecarCargaDeTela();
    pedido = importarComRecarga(fonte.carregar)()
      .then((controlador) => {
        guardar(view, controlador);
        return controlador;
      })
      .finally(() => {
        pedidos.delete(view);
        terminar();
      });
    pedidos.set(view, pedido);
  }
  return pedido;
}

/** Pré-carga (mouse no item do menu): baixa sem avisar a falha. */
export function preCarregarTelaRegistrada(view: string): void {
  if (!ehTelaRegistrada(view) || telaNaHora(view)) return;
  void carregarTela(view).catch(() => {});
}

/**
 * A seção deixa sair? Só pergunta à que já baixou (antes da carga, nada
 * aberto, nada a perder): Acessos e Módulos e abas guardam rascunho.
 */
export function confirmarSaidaDaSecao(secao: string): boolean {
  if (!ehSecaoComTela(secao)) return true;
  return telaPronta(viewDaSecao(secao))?.confirmarSaida() !== false;
}

/** Sair de Configurações: Acessos e Módulos e abas, com rascunho, perguntam. */
export function confirmarSaidaDasSecoes(): boolean {
  return confirmarSaidaDaSecao("acessos") && confirmarSaidaDaSecao("modulos");
}
