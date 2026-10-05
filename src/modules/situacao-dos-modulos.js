/*
  Manutenção na tela: a situação do sistema e das áreas
  (`obter_situacao_do_sistema`), a tela "Em manutenção" e a faixa do
  administrador global.

  Quem decide o que vale é `src/lib/situacao-dos-modulos.js` (sem DOM). O
  app (src/app/carga.js e src/app/navegacao.js) só:
    - dispara a consulta junto com as outras da entrada
      (`consultaDaSituacaoDoSistema`) e aplica a resposta
      (`carregarSituacaoDoSistema`) antes do `buildNav`, que tira do menu as
      áreas desativadas (`situacaoDoSistema()`);
    - pergunta, a cada `navigate`, se a página abre
      (`aplicarManutencaoNaNavegacao`). Quem não é administrador global vê a
      tela de manutenção no lugar da página; o administrador vê a página, com
      a faixa âmbar "Em manutenção para os demais usuários".

  A situação NÃO vai na cópia da sessão: é sempre a do banco, nesta entrada.
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
} from "../lib/situacao-dos-modulos.js";
import { criarIcone } from "./icones.js";

const RPC_SITUACAO_DO_SISTEMA = "obter_situacao_do_sistema";
/* PostgREST: a função não existe (migration ainda não aplicada). Não é falha. */
const FUNCAO_AUSENTE = "PGRST202";

const ID_DA_PAGINA = "page-manutencao";
const ID_DA_FAIXA = "faixaDeManutencao";

let situacao = SITUACAO_PADRAO;

/** Dispara a consulta já; nunca rejeita. */
export function consultaDaSituacaoDoSistema(sb) {
  if (!sb) return Promise.resolve({ data: null, error: null });
  return Promise.resolve(sb.rpc(RPC_SITUACAO_DO_SISTEMA)).catch((error) => ({
    data: null,
    error,
  }));
}

/** Aplica a resposta; sem ela, tudo ativo. Devolve a situação em uso. */
export async function carregarSituacaoDoSistema({ consulta } = {}) {
  let resposta;
  try {
    resposta = await consulta;
  } catch (error) {
    resposta = { data: null, error };
  }
  const { data, error } = resposta || {};
  if (error && error.code !== FUNCAO_AUSENTE)
    console.warn("Situação do sistema indisponível; tudo ativo:", error);
  situacao = error ? SITUACAO_PADRAO : normalizarSituacaoDoSistema(data);
  return situacao;
}

export function situacaoDoSistema() {
  return situacao;
}

/** Ao sair da conta: a próxima pessoa não herda a situação lida. */
export function esquecerSituacaoDoSistema(documento = globalThis.document) {
  situacao = SITUACAO_PADRAO;
  esconderFaixa(documento);
  documento?.getElementById?.(ID_DA_PAGINA)?.classList.remove("active");
}

function esconderFaixa(documento) {
  const faixa = documento?.getElementById?.(ID_DA_FAIXA);
  if (faixa) faixa.hidden = true;
}

function garantirFaixa(documento) {
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

function garantirPagina(documento) {
  let pagina = documento.getElementById(ID_DA_PAGINA);
  if (pagina) return pagina;
  const conteudo = documento.querySelector("#conteudoPrincipal > .content");
  if (!conteudo) return null;
  pagina = documento.createElement("section");
  pagina.id = ID_DA_PAGINA;
  pagina.className = "page pagina-de-manutencao";
  const cartao = documento.createElement("div");
  cartao.className = "pagina-de-manutencao__cartao";
  const icone = documento.createElement("span");
  icone.className = "pagina-de-manutencao__icone";
  icone.append(criarIcone("wrench", { tamanho: 28 }));
  const titulo = documento.createElement("h2");
  const mensagem = documento.createElement("p");
  mensagem.className = "pagina-de-manutencao__mensagem";
  const previsao = documento.createElement("p");
  previsao.className = "pagina-de-manutencao__previsao";
  cartao.append(icone, titulo, mensagem, previsao);
  pagina.append(cartao);
  conteudo.append(pagina);
  return pagina;
}

function mostrarPaginaDeManutencao(documento, efetiva) {
  const pagina = garantirPagina(documento);
  if (!pagina) return false;
  const textos = textosDaManutencao(efetiva);
  pagina.querySelector("h2").textContent = textos.titulo;
  pagina.querySelector(".pagina-de-manutencao__mensagem").textContent =
    textos.mensagem;
  const previsao = pagina.querySelector(".pagina-de-manutencao__previsao");
  previsao.textContent = textos.previsao;
  previsao.hidden = !textos.previsao;
  pagina.dataset.origem = efetiva.origem;
  pagina.classList.add("active");
  return true;
}

/**
 * Chamada pelo `navigate` do legado, com as páginas já escondidas. Devolve
 * `true` quando mostrou a tela de manutenção no lugar da página (quem chama
 * para ali); `false` quando a página abre — com a faixa, se o administrador
 * global abriu uma página em manutenção.
 */
export function aplicarManutencaoNaNavegacao({
  documento = globalThis.document,
  view,
  area,
  abas,
  adminGlobal = false,
} = {}) {
  if (!documento) return false;
  documento.getElementById(ID_DA_PAGINA)?.classList.remove("active");
  const efetiva = situacaoEfetiva({ situacao, abas, view, area });
  if (!efetiva) {
    esconderFaixa(documento);
    return false;
  }
  if (adminGlobal || situacao.adminGlobal) {
    const faixa = garantirFaixa(documento);
    if (faixa) {
      faixa.querySelector("span").textContent =
        textoDaFaixaDoAdministrador(efetiva);
      faixa.dataset.origem = efetiva.origem;
      faixa.hidden = false;
    }
    return false;
  }
  esconderFaixa(documento);
  return mostrarPaginaDeManutencao(documento, efetiva);
}
