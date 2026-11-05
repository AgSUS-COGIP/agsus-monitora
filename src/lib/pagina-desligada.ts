import type {
  AbaDoCatalogo,
  ArvoreDoMenu,
  ItemDoMenu,
} from "../componentes/barra-lateral/tipos.ts";
import {
  ABAS_DO_MENU,
  ehAreaDoSistema,
  paginasDaArea,
} from "./menu-lateral.ts";
import {
  areaEstaAtiva,
  situacaoEfetiva,
  textoDaFaixaDoAdministrador,
  textosDaManutencao,
} from "./situacao-dos-modulos.ts";
import type {
  AbaDaSituacao,
  SituacaoDoSistema,
  SituacaoEfetiva,
} from "./situacao-dos-modulos.ts";

/*
  Página desligada pela coordenação — sem DOM.

  A coordenação desliga abas por área (Configurações › Módulos e abas) para
  aliviar o banco. Aba desligada nem chega no catálogo do banco
  (`listar_abas_do_menu`), e área desligada sai da situação do sistema; o
  menu já some com elas. Faltava a página: quem estava nela (ou chega por
  link, busca ou tela guardada) continuava lá, consultando o banco. Aqui se
  decide se a página (view) na área está desligada; quem fecha a página é a
  navegação (src/app/navegacao.ts), e quem percebe a mudança no meio da
  sessão é o vigia do catálogo (src/app/vigia-do-catalogo.ts).

  Só vale para as views de aba (as do catálogo do código, `ABAS_DO_MENU`, ou
  as do catálogo em uso): Configurações, painéis externos e telas fora do
  catálogo nunca contam como desligadas. Sem o catálogo do banco (função
  ainda não publicada, erro de rede), nada está desligado — a tela nunca
  tranca ninguém por falha de rede.

  A regra é a mesma para todos, administrador global inclusive: o catálogo do
  banco não mostra aba desligada para ninguém (só a manutenção tem a exceção
  do administrador, em src/lib/situacao-dos-modulos.ts).
*/

type Situacao = Parameters<typeof areaEstaAtiva>[0];

const viewsDa = (aba: AbaDoCatalogo) => [
  aba.view,
  ...aba.areas.map((item) => item.view || aba.view),
];

const ehViewDeAba = (abas: readonly AbaDoCatalogo[], view: string) =>
  [...ABAS_DO_MENU, ...abas].some((aba) => viewsDa(aba).includes(view));

export interface ConsultaDaPagina {
  /** O catálogo em uso (`abasDoMenu()`). */
  abas: readonly AbaDoCatalogo[];
  /** O catálogo em uso veio do banco (e não do código). */
  doBanco: boolean;
  situacao?: Situacao;
  view: string;
  area?: string | null;
}

/** A página (view) na área foi desligada pela coordenação? */
export function paginaDesligada({
  abas,
  doBanco,
  situacao,
  view,
  area,
}: ConsultaDaPagina): boolean {
  if (!doBanco || !view || !ehViewDeAba(abas, view)) return false;
  if (area && ehAreaDoSistema(area)) {
    if (!areaEstaAtiva(situacao, area)) return true;
    return !paginasDaArea(abas, area).some((pagina) => pagina.view === view);
  }
  // Página aberta sem área: desligada só se não estiver em área nenhuma.
  return !abas.some((aba) =>
    aba.areas.some((item) => (item.view || aba.view) === view),
  );
}

/*
  Para onde vai o botão da página desligada: a primeira página do menu na
  área atual; sem nenhuma, a primeira de qualquer grupo (Painéis,
  Configurações). A árvore do menu só tem o que está ligado e permitido.
  Devolve o item (a view e a área dele, que vira a área atual), ou `null`
  quando o menu não tem outra página — quem chama usa a inicial do sistema.
*/
export function primeiraPaginaLigada(
  arvore: ArvoreDoMenu,
  area: string | null | undefined,
  atual: string,
): ItemDoMenu | null {
  const itens = [
    ...arvore.filter((grupo) => grupo.id === area),
    ...arvore.filter((grupo) => grupo.id !== area),
  ].flatMap((grupo) => grupo.itens);
  return itens.find((item) => item.view !== atual) ?? null;
}

export const TEXTOS_DA_PAGINA_DESLIGADA = Object.freeze({
  titulo: "Página desativada",
  mensagem: "Esta página foi desativada pela coordenação.",
  botao: "Ir para a página inicial",
});

/*
  Quem tem trabalho não salvo na página que acabou de ser desligada (ou de
  entrar em manutenção) não perde nada: a página fica, com esta faixa, e fecha
  na próxima checagem depois de salvo.
*/
export function textoDaFaixaDeSaida(origem: "desligada" | "manutencao") {
  return origem === "desligada"
    ? "Esta página foi desativada pela coordenação. Salve o que estiver fazendo: ela fecha depois disso."
    : "Esta página entrou em manutenção. Salve o que estiver fazendo: ela fecha depois disso.";
}

/** O aviso que toma o lugar da página: desativada, ou em manutenção. */
export interface AvisoNoLugarDaPagina {
  readonly origem: "desligada" | SituacaoEfetiva["origem"];
  readonly icone: "circle-alert" | "wrench";
  readonly titulo: string;
  readonly mensagem: string;
  /** "Previsão de volta: …", ou vazio. */
  readonly previsao: string;
}

/** A faixa acima da página (o administrador vê a manutenção; ou "salve e sai"). */
export interface FaixaDaPagina {
  readonly texto: string;
  readonly origem: string;
}

/**
 * Se a página abre, e como. Desligada pela coordenação: o aviso, para todos.
 * Em manutenção (sistema, área ou aba): quem não é administrador global vê o
 * aviso no lugar da página; o administrador vê a página, com a faixa.
 */
export function avisoDaPagina({
  situacao,
  abas,
  view,
  area,
  adminGlobal = false,
  desligada = false,
}: {
  situacao: SituacaoDoSistema;
  abas?: readonly AbaDaSituacao[] | null;
  view: string;
  area: string;
  adminGlobal?: boolean;
  desligada?: boolean;
}): { pagina: AvisoNoLugarDaPagina | null; faixa: FaixaDaPagina | null } {
  if (desligada)
    return {
      pagina: Object.freeze({
        origem: "desligada",
        icone: "circle-alert",
        titulo: TEXTOS_DA_PAGINA_DESLIGADA.titulo,
        mensagem: TEXTOS_DA_PAGINA_DESLIGADA.mensagem,
        previsao: "",
      }),
      faixa: null,
    };
  const efetiva = situacaoEfetiva({ situacao, abas, view, area });
  if (!efetiva) return { pagina: null, faixa: null };
  if (adminGlobal || situacao.adminGlobal)
    return {
      pagina: null,
      faixa: Object.freeze({
        texto: textoDaFaixaDoAdministrador(efetiva),
        origem: efetiva.origem,
      }),
    };
  return {
    pagina: Object.freeze({
      origem: efetiva.origem,
      icone: "wrench",
      ...textosDaManutencao(efetiva),
    }),
    faixa: null,
  };
}
