/*
  Manutenção na tela: a situação do sistema e das áreas
  (`obter_situacao_do_sistema`), a tela "Em manutenção" e a faixa do
  administrador global.

  Quem decide o que vale é `src/lib/situacao-dos-modulos.ts` (sem DOM). O
  app (src/app/carga.ts e src/app/navegacao.ts) só:
    - dispara a consulta junto com as outras da entrada
      (`consultaDaSituacaoDoSistema`) e aplica a resposta
      (`carregarSituacaoDoSistema`) antes do `buildNav`, que tira do menu as
      áreas desativadas (`situacaoDoSistema()`);
    - pergunta, a cada `navigate`, se a página abre
      (`aplicarManutencaoNaNavegacao`). Quem não é administrador global vê a
      tela de manutenção no lugar da página; o administrador vê a página, com
      a faixa âmbar "Em manutenção para os demais usuários". Página desligada
      pela coordenação (src/lib/pagina-desligada.ts) fecha para todos, com o
      aviso "Esta página foi desativada pela coordenação.". As duas telas têm
      o botão para a página inicial.

  A situação NÃO vai na cópia da sessão: é sempre a do banco, nesta entrada
  (e relida no meio da sessão pelo vigia do catálogo,
  src/app/vigia-do-catalogo.ts, quando a versão muda).
  Falhou a consulta (rede, função ainda não publicada), vale tudo ativo — a
  tela nunca tranca ninguém por erro de rede. Sair da conta continua na barra
  lateral, que não é tocada aqui.
*/
import {
  normalizarSituacaoDoSistema,
  situacaoEfetiva,
  SITUACAO_PADRAO,
  textoDaFaixaDoAdministrador,
  textosDaManutencao,
} from "../lib/situacao-dos-modulos.ts";
import type {
  AbaDaSituacao,
  RespostaDaSituacao,
  SituacaoDoSistema,
} from "../lib/situacao-dos-modulos.ts";
import { TEXTOS_DA_PAGINA_DESLIGADA } from "../lib/pagina-desligada.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OpcoesDaCargaDoBanco,
  RespostaDaConsulta,
} from "./catalogo-de-abas.ts";
import { criarIcone } from "./icones.ts";
import type { NomeDoIconeRegistrado } from "./icones.ts";

/** O documento, no que a manutenção usa (os testes passam um parcial). */
type DocumentoDaManutencao = Document | null | undefined;

/** De onde veio a tela: página desligada ou a manutenção que vale. */
type OrigemDaTela = "desligada" | "sistema" | "area" | "aba" | "aba_area";

/** Os textos da tela de manutenção (ou de página desativada). */
interface TextosDaTela {
  readonly titulo: string;
  readonly mensagem: string;
  readonly previsao?: string;
}

/** As opções de `aplicarManutencaoNaNavegacao`. */
export interface OpcoesDaManutencaoNaNavegacao {
  documento?: DocumentoDaManutencao;
  view?: string;
  area?: string;
  abas?: readonly AbaDaSituacao[] | null;
  adminGlobal?: boolean;
  desligada?: boolean;
  aoIrParaInicio?: (() => void) | null;
}

const RPC_SITUACAO_DO_SISTEMA = "obter_situacao_do_sistema";
/* PostgREST: a função não existe (migration ainda não aplicada). Não é falha. */
const FUNCAO_AUSENTE = "PGRST202";

const ID_DA_PAGINA = "page-manutencao";
const ID_DA_FAIXA = "faixaDeManutencao";

let situacao: SituacaoDoSistema = SITUACAO_PADRAO;

/** Dispara a consulta já; nunca rejeita. */
export function consultaDaSituacaoDoSistema(
  sb: Pick<SupabaseClient, "rpc"> | null | undefined,
): Promise<RespostaDaConsulta> {
  if (!sb) return Promise.resolve({ data: null, error: null });
  return Promise.resolve(sb.rpc(RPC_SITUACAO_DO_SISTEMA)).catch((error) => ({
    data: null,
    error,
  }));
}

/** Aplica a resposta; sem ela, tudo ativo. Devolve a situação em uso. */
export async function carregarSituacaoDoSistema({
  consulta,
}: OpcoesDaCargaDoBanco = {}): Promise<SituacaoDoSistema> {
  let resposta: { data?: unknown; error?: unknown } | null | undefined;
  try {
    resposta = await consulta;
  } catch (error) {
    resposta = { data: null, error };
  }
  const { data, error } = resposta || {};
  if (error && (error as { code?: unknown }).code !== FUNCAO_AUSENTE)
    console.warn("Situação do sistema indisponível; tudo ativo:", error);
  situacao = error
    ? SITUACAO_PADRAO
    : normalizarSituacaoDoSistema(
        data as RespostaDaSituacao | null | undefined,
      );
  return situacao;
}

export function situacaoDoSistema(): SituacaoDoSistema {
  return situacao;
}

/** Ao sair da conta: a próxima pessoa não herda a situação lida. */
export function esquecerSituacaoDoSistema(
  documento: DocumentoDaManutencao = globalThis.document,
): void {
  situacao = SITUACAO_PADRAO;
  esconderFaixa(documento);
  documento?.getElementById?.(ID_DA_PAGINA)?.classList.remove("active");
}

function esconderFaixa(documento: DocumentoDaManutencao) {
  const faixa = documento?.getElementById?.(ID_DA_FAIXA);
  if (faixa) faixa.hidden = true;
}

function garantirFaixa(documento: Document): HTMLElement | null {
  let faixa = documento.getElementById(ID_DA_FAIXA);
  if (faixa) return faixa;
  const conteudo = documento.querySelector("#conteudoPrincipal > .content");
  if (!conteudo) return null;
  faixa = documento.createElement("div");
  faixa.id = ID_DA_FAIXA;
  faixa.className = "faixa-de-manutencao";
  faixa.setAttribute("role", "status");
  faixa.hidden = true;
  faixa.append(
    criarIcone("wrench", { tamanho: 16 }),
    documento.createElement("span"),
  );
  conteudo.before(faixa);
  return faixa;
}

function garantirPagina(
  documento: Document,
  aoIrParaInicio: (() => void) | null,
): HTMLElement | null {
  let pagina = documento.getElementById(ID_DA_PAGINA);
  if (pagina) {
    irParaInicio = aoIrParaInicio;
    return pagina;
  }
  const conteudo = documento.querySelector("#conteudoPrincipal > .content");
  if (!conteudo) return null;
  pagina = documento.createElement("section");
  pagina.id = ID_DA_PAGINA;
  pagina.className = "page pagina-de-manutencao";
  const cartao = documento.createElement("div");
  cartao.className = "pagina-de-manutencao__cartao";
  const icone = documento.createElement("span");
  icone.className = "pagina-de-manutencao__icone";
  const titulo = documento.createElement("h2");
  const mensagem = documento.createElement("p");
  mensagem.className = "pagina-de-manutencao__mensagem";
  const previsao = documento.createElement("p");
  previsao.className = "pagina-de-manutencao__previsao";
  const botao = documento.createElement("button");
  botao.type = "button";
  botao.className = "btn pagina-de-manutencao__botao";
  botao.textContent = TEXTOS_DA_PAGINA_DESLIGADA.botao;
  botao.addEventListener("click", () => irParaInicio?.());
  cartao.append(icone, titulo, mensagem, previsao, botao);
  pagina.append(cartao);
  conteudo.append(pagina);
  irParaInicio = aoIrParaInicio;
  return pagina;
}

/* O botão leva à página inicial que a navegação escolher na hora do clique. */
let irParaInicio: (() => void) | null = null;

function mostrarPagina(
  documento: Document,
  {
    textos,
    origem,
    icone,
    aoIrParaInicio,
  }: {
    textos: TextosDaTela;
    origem: OrigemDaTela;
    icone: NomeDoIconeRegistrado;
    aoIrParaInicio: (() => void) | null;
  },
): boolean {
  const pagina = garantirPagina(documento, aoIrParaInicio);
  if (!pagina) return false;
  const lugarDoIcone = pagina.querySelector(".pagina-de-manutencao__icone")!;
  lugarDoIcone.replaceChildren(criarIcone(icone, { tamanho: 28 }));
  pagina.querySelector("h2")!.textContent = textos.titulo;
  pagina.querySelector(".pagina-de-manutencao__mensagem")!.textContent =
    textos.mensagem;
  const previsao = pagina.querySelector<HTMLElement>(
    ".pagina-de-manutencao__previsao",
  )!;
  previsao.textContent = textos.previsao || "";
  previsao.hidden = !textos.previsao;
  pagina.querySelector<HTMLElement>(".pagina-de-manutencao__botao")!.hidden =
    !aoIrParaInicio;
  pagina.dataset.origem = origem;
  pagina.classList.add("active");
  return true;
}

/** A tela de manutenção (ou de página desativada) está aberta no lugar da página. */
export function avisoNoLugarDaPagina(
  documento: DocumentoDaManutencao = globalThis.document,
): boolean {
  return Boolean(
    documento?.getElementById?.(ID_DA_PAGINA)?.classList.contains("active"),
  );
}

/*
  A página atual foi desligada (ou entrou em manutenção) com trabalho não
  salvo: ela fica, com a faixa avisando, até a próxima checagem depois de
  salvo (src/app/navegacao.ts, `reavaliarTelaAtual`).
*/
export function avisarNaFaixa(
  documento: DocumentoDaManutencao,
  texto: string,
  origem: string,
): void {
  const faixa = documento && garantirFaixa(documento);
  if (!faixa) return;
  faixa.querySelector("span")!.textContent = texto;
  faixa.dataset.origem = origem;
  faixa.hidden = false;
}

/**
 * Chamada pelo `navigate` do legado, com as páginas já escondidas. Devolve
 * `true` quando mostrou a tela de manutenção (ou a de página desativada,
 * `desligada`) no lugar da página (quem chama para ali); `false` quando a
 * página abre — com a faixa, se o administrador global abriu uma página em
 * manutenção. `aoIrParaInicio` é o botão das duas telas.
 */
export function aplicarManutencaoNaNavegacao({
  documento = globalThis.document,
  view,
  area,
  abas,
  adminGlobal = false,
  desligada = false,
  aoIrParaInicio = null,
}: OpcoesDaManutencaoNaNavegacao = {}): boolean {
  if (!documento) return false;
  documento.getElementById(ID_DA_PAGINA)?.classList.remove("active");
  if (desligada) {
    esconderFaixa(documento);
    return mostrarPagina(documento, {
      textos: TEXTOS_DA_PAGINA_DESLIGADA,
      origem: "desligada",
      icone: "circle-alert",
      aoIrParaInicio,
    });
  }
  const efetiva = situacaoEfetiva({ situacao, abas, view, area });
  if (!efetiva) {
    esconderFaixa(documento);
    return false;
  }
  if (adminGlobal || situacao.adminGlobal) {
    const faixa = garantirFaixa(documento);
    if (faixa) {
      faixa.querySelector("span")!.textContent =
        textoDaFaixaDoAdministrador(efetiva);
      faixa.dataset.origem = efetiva.origem;
      faixa.hidden = false;
    }
    return false;
  }
  esconderFaixa(documento);
  return mostrarPagina(documento, {
    textos: textosDaManutencao(efetiva),
    origem: efetiva.origem,
    icone: "wrench",
    aoIrParaInicio,
  });
}
