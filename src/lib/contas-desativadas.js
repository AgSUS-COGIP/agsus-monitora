/*
  Contas desativadas em Configurações › Acessos, sem DOM e sem React: a aba
  "Desativadas" (listar_contas_desativadas), a reativação
  (reativar_acesso_usuario) e o pedido de reativação em "Pendentes"
  (listar_solicitacoes_acesso com `reativacao`).

  As travas repetem as do banco (23514) para a tela não oferecer o que vai
  ser recusado: grupo que não é de administrador precisa de área ou
  coordenação; grupo que gerencia acessos precisa de coordenação. O nível em
  "acessos" que a tela conhece é o do grupo; exceção individual o banco
  confere de novo.
*/

import { dataCurta } from "./convite-de-acesso.js";
import { mensagemDeFalha } from "./falha-de-rede.js";
import {
  ficariaSemArea,
  gerenciariaAcessosSemCoordenacao,
} from "./matriz-de-acessos.js";
import { diaEMes } from "./solicitacao-de-acesso.js";

const txt = (valor) => String(valor ?? "").trim();

export const MOTIVO_NAO_REGISTRADO = "motivo não registrado";
export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 500;

/** Resposta de listar_contas_desativadas → lista (nunca null). */
export function contasDaResposta(resposta) {
  return Array.isArray(resposta?.contas) ? resposta.contas : [];
}

/** "Desativada em 30/09/2026 por ana@…" (sem "por" quando não se sabe quem). */
export function linhaDaDesativacao(conta) {
  const data = dataCurta(conta?.desativada_em);
  const por = txt(conta?.desativada_por);
  return `Desativada${data ? ` em ${data}` : ""}${por ? ` por ${por}` : ""}`;
}

/** O motivo gravado ou "motivo não registrado" (contas desativadas antes do histórico). */
export function motivoDaDesativacao(conta) {
  return txt(conta?.motivo) || MOTIVO_NAO_REGISTRADO;
}

/**
 * Linha do pedido de reativação em "Pendentes":
 *   "Desativada em 30/09 por ana@… · motivo: saiu da equipe"
 */
export function linhaDoPedidoDeReativacao(solicitacao) {
  const dia = diaEMes(solicitacao?.desativada_em);
  const por = txt(solicitacao?.desativada_por);
  const motivo = txt(solicitacao?.motivo_desativacao) || MOTIVO_NAO_REGISTRADO;
  return `Desativada${dia ? ` em ${dia}` : ""}${por ? ` por ${por}` : ""} · motivo: ${motivo}`;
}

/**
 * Grupo que o "Aprovar" já traz: no pedido de reativação, o de antes (se
 * quem aprova pode atribuí-lo); senão "usuario" ou o primeiro possível.
 */
export function grupoInicialDoPedido(solicitacao, gruposPossiveis = []) {
  const existe = (codigo) =>
    codigo && gruposPossiveis.some((g) => g.codigo === codigo);
  if (solicitacao?.reativacao && existe(solicitacao.grupo_anterior))
    return solicitacao.grupo_anterior;
  if (existe("usuario")) return "usuario";
  return gruposPossiveis[0]?.codigo || "";
}

/** "23 ativas · 2 desativadas" (sem desativadas conhecidas: só as ativas). */
export function resumoDeContas({ ativas = 0, desativadas = null } = {}) {
  const parte = (n, um, varios) =>
    `${Number(n).toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
  const texto = parte(ativas, "ativa", "ativas");
  return desativadas === null || desativadas === undefined
    ? texto
    : `${texto} · ${parte(desativadas, "desativada", "desativadas")}`;
}

/** Valores do formulário de reativação: grupo, coordenação e áreas de antes. */
export function valoresIniciaisDaReativacao(conta, grupos = []) {
  const grupoDeAntes = grupos.find((g) => g.codigo === conta?.grupo)
    ? conta.grupo
    : grupoInicialDoPedido({}, grupos);
  return {
    grupo: grupoDeAntes,
    coordenacao: txt(conta?.coordenacao),
    areas: Array.isArray(conta?.areas) ? [...conta.areas] : [],
    motivo: "",
  };
}

/**
 * Travas da reativação ({} = pode gravar):
 *   semArea         sem coordenação e sem área (23514 no banco)
 *   semCoordenacao  o grupo gerencia acessos e não há coordenação (23514)
 *   motivo          motivo com menos de 3 ou mais de 500 caracteres
 */
export function errosDaReativacao(
  { grupo, coordenacao, areas, motivo } = {},
  grupos = [],
) {
  const doGrupo = grupos.find((g) => g.codigo === grupo);
  const adminGlobal = Boolean(doGrupo?.admin_global);
  const erros = {};
  if (!doGrupo) erros.grupo = "Escolha o grupo.";
  if (ficariaSemArea({ adminGlobal, coordenacao, areasMarcadas: areas }))
    erros.semArea = true;
  if (
    gerenciariaAcessosSemCoordenacao({
      adminGlobal,
      coordenacao,
      nivelAcessos: doGrupo?.niveis?.acessos,
    })
  )
    erros.semCoordenacao = true;
  const tamanho = txt(motivo).length;
  if (tamanho < MOTIVO_MINIMO || tamanho > MOTIVO_MAXIMO)
    erros.motivo = `Informe o motivo (${MOTIVO_MINIMO} a ${MOTIVO_MAXIMO} caracteres).`;
  return erros;
}

/**
 * Argumentos de reativar_acesso_usuario. Administrador global não leva
 * coordenação nem áreas; com coordenação, as áreas vêm dela (como na gaveta).
 */
export function argumentosDaReativacao(conta, valores, grupos = []) {
  const adminGlobal = Boolean(
    grupos.find((g) => g.codigo === valores.grupo)?.admin_global,
  );
  const coordenacao = adminGlobal ? "" : txt(valores.coordenacao);
  return {
    p_perfil_usuario_id: conta.id,
    p_grupo: valores.grupo,
    p_coordenacao: coordenacao || null,
    p_areas: adminGlobal || coordenacao ? [] : [...(valores.areas || [])],
    p_motivo: txt(valores.motivo),
  };
}

/** Mensagem para a recusa do banco ao reativar (23514 e 22023 já vêm claras). */
export function mensagemDaRecusaDeReativacao(erro) {
  if (erro?.code === "42501")
    return "Só o administrador global pode reativar contas.";
  if (["23514", "22023"].includes(erro?.code) && txt(erro?.message))
    return txt(erro.message);
  return mensagemDeFalha(erro);
}

/** Toast depois de reativar. */
export function mensagemDeContaReativada(conta) {
  const nome = txt(conta?.nome) || txt(conta?.email) || "a pessoa";
  return `Conta reativada. Na próxima entrada, ${nome} verá as boas-vindas de volta.`;
}
