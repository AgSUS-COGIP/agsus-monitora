/*
  Formulário "Solicitar acesso" (tela de quem entrou sem perfil). Antes o
  navegador gravava direto em TB_SOLICITACAO_ACESSO; agora tudo passa por RPC,
  e a pessoa escolhe a coordenação — o coordenador dela pode aprovar.
  Regras e textos em src/lib/solicitacao-de-acesso.js.
*/

import {
  argumentosDaSolicitacao,
  formularioTravado,
  mensagemDoStatus,
} from "../lib/solicitacao-de-acesso.js";

const RPC_COORDENACOES_ATIVAS = "listar_coordenacoes_ativas";
const RPC_MINHA_SOLICITACAO = "obter_minha_solicitacao_acesso";
const RPC_REGISTRAR_SOLICITACAO = "registrar_solicitacao_acesso";
const RPC_ACESSO_BASICO = "garantir_acesso_basico";

const CAMPOS = [
  "accessReqNome",
  "accessReqSetor",
  "accessReqCoordenacao",
  "accessReqJustificativa",
];

/**
 * Conta @agenciasus.org.br sem perfil ganha o acesso básico (grupo "usuario")
 * sem pedir. Devolve true se criou agora — aí vale reler o contexto. O banco
 * decide o domínio e não reativa perfil desativado.
 */
export async function garantirAcessoBasico(sb) {
  const { data, error } = await sb.rpc(RPC_ACESSO_BASICO);
  if (error) {
    console.warn("Acesso básico automático indisponível:", error.message || error);
    return false;
  }
  return data?.criado === true;
}

/** Opções de coordenação, agrupadas por área (createElement, sem innerHTML). */
export async function preencherCoordenacoes(sb, doc = document) {
  const select = doc.getElementById("accessReqCoordenacao");
  if (!select || select.dataset.carregado === "1") return;
  const { data, error } = await sb.rpc(RPC_COORDENACOES_ATIVAS);
  if (error || !Array.isArray(data)) return;
  select.dataset.carregado = "1";
  const grupos = new Map();
  for (const c of data) {
    if (!grupos.has(c.area)) {
      const grupo = doc.createElement("optgroup");
      grupo.label = c.area_nome || c.area;
      grupos.set(c.area, grupo);
      select.appendChild(grupo);
    }
    const opcao = doc.createElement("option");
    opcao.value = c.codigo;
    opcao.textContent = c.nome;
    grupos.get(c.area).appendChild(opcao);
  }
}

function travar(doc, travado) {
  CAMPOS.forEach((id) => {
    const campo = doc.getElementById(id);
    if (campo) campo.disabled = travado;
  });
  const botao = doc.getElementById("accessRequestBtn");
  if (botao) botao.disabled = travado;
}

function mostrarStatus(doc, mensagem) {
  const status = doc.getElementById("accessRequestStatus");
  if (!status) return;
  status.classList.toggle("hidden", !mensagem);
  status.classList.toggle("success", mensagem?.tone === "success");
  status.classList.toggle("warn", mensagem?.tone === "info");
  status.textContent = mensagem?.text || "";
}

/** Lê a última solicitação, mostra o status e trava o formulário se preciso. */
export async function carregarMinhaSolicitacao(sb, doc = document) {
  void preencherCoordenacoes(sb, doc);
  const { data, error } = await sb.rpc(RPC_MINHA_SOLICITACAO);
  if (error) {
    mostrarStatus(doc, {
      tone: "warn",
      text: "Não foi possível consultar sua solicitação anterior. Tente de novo em instantes.",
    });
    travar(doc, false);
    return null;
  }
  mostrarStatus(doc, mensagemDoStatus(data));
  travar(doc, formularioTravado(data));
  return data || null;
}

/** Envia o formulário. Devolve { ok, mensagem }. */
export async function enviarSolicitacao(sb, campos, doc = document) {
  const { error } = await sb.rpc(
    RPC_REGISTRAR_SOLICITACAO,
    argumentosDaSolicitacao(campos),
  );
  if (error) return { ok: false, mensagem: error.message };
  await carregarMinhaSolicitacao(sb, doc);
  return { ok: true, mensagem: "" };
}
