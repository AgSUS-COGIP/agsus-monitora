/*
  Pedidos de acesso — o único módulo de UI do assunto:
    1. a tela "Solicitar acesso" (quem entrou com Google e não tem perfil
       ativo): situação do pedido, formulário, validação e envio, tudo por RPC;
    2. o item de pedido pendente da lista administrativa antiga de
       Configurações (renderAccessRequestAdminItemHTML).
  Regras e textos em src/lib/solicitacao-de-acesso.js.
*/

import { ACCESS_ROLES, normalizeRole } from "../lib/access-roles.js";
import { normalizePlatformContext } from "../lib/platform-context.js";
import {
  argumentosDaSolicitacao,
  contaDesativadaNaResposta,
  telaDaSolicitacao,
  validarSolicitacao,
} from "../lib/solicitacao-de-acesso.js";
import {
  lembrarContaDesativada,
  marcarBoasVindasPendentes,
} from "./comemoracao-do-acesso.js";

const RPC_COORDENACOES_ATIVAS = "listar_coordenacoes_ativas";
const RPC_MINHA_SOLICITACAO = "obter_minha_solicitacao_acesso";
const RPC_REGISTRAR_SOLICITACAO = "registrar_solicitacao_acesso";
const RPC_ACESSO_BASICO = "garantir_acesso_basico";
const RPC_CONTEXTO = "obter_contexto_monitora";

/* id do campo → chave do formulário (validarSolicitacao / argumentos). */
const CAMPOS = Object.freeze({
  accessReqNome: "nome",
  accessReqSetor: "setor",
  accessReqCoordenacao: "coordenacao",
  accessReqJustificativa: "justificativa",
});

/*
  Resposta de garantir_acesso_basico na última carga do perfil: diz se a conta
  existe e está desativada (a tela não tem outra fonte para isso).
*/
let contaDesativada = false;

/**
 * Conta @agenciasus.org.br sem perfil ganha o acesso básico (grupo "usuario")
 * sem pedir. Devolve true se criou agora — aí vale reler o contexto. O banco
 * decide o domínio e não reativa perfil desativado; a resposta "existente"
 * marca a conta como desativada para a tela.
 */
export async function garantirAcessoBasico(sb) {
  contaDesativada = false;
  const { data, error } = await sb.rpc(RPC_ACESSO_BASICO);
  if (error) {
    console.warn(
      "Acesso básico automático indisponível:",
      error.message || error,
    );
    return false;
  }
  contaDesativada = contaDesativadaNaResposta(data);
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

/** Valores dos campos do formulário. */
export function lerCampos(doc = document) {
  const valores = {};
  for (const [id, chave] of Object.entries(CAMPOS))
    valores[chave] = doc.getElementById(id)?.value ?? "";
  return valores;
}

/** Mostra (ou limpa) o erro de cada campo, logo abaixo dele. */
export function mostrarErros(doc, erros = {}) {
  for (const [id, chave] of Object.entries(CAMPOS)) {
    const campo = doc.getElementById(id);
    const aviso = doc.getElementById(`${id}Erro`);
    const texto = erros[chave] || "";
    if (campo) {
      if (texto) campo.setAttribute("aria-invalid", "true");
      else campo.removeAttribute("aria-invalid");
    }
    if (aviso) {
      aviso.textContent = texto;
      aviso.classList.toggle("hidden", !texto);
    }
  }
}

/** Status da tela: título, texto e o botão "Entrar agora" quando liberado. */
export function mostrarStatus(doc, tela) {
  const status = doc.getElementById("accessRequestStatus");
  if (!status) return;
  status.classList.toggle("hidden", !tela?.texto);
  for (const tom of ["info", "success", "warn", "danger"])
    status.classList.toggle(tom, tela?.tom === tom);
  const titulo = doc.getElementById("accessRequestStatusTitulo");
  if (titulo) {
    titulo.textContent = tela?.titulo || "";
    titulo.classList.toggle("hidden", !tela?.titulo);
  }
  const texto = doc.getElementById("accessRequestStatusTexto");
  if (texto) texto.textContent = tela?.texto || "";
  // Conta desativada não pede nada: o título muda e os textos de pedido e convite somem.
  const desativada = tela?.ilustracao === "triste";
  const tituloDoCartao = doc.getElementById("accessRequestTitulo");
  if (tituloDoCartao)
    tituloDoCartao.textContent = desativada
      ? "Acesso desativado"
      : "Solicitar acesso";
  for (const seletor of [".access-request-subtitle", ".access-request-invite"])
    doc
      .querySelector(`#accessRequestCard ${seletor}`)
      ?.classList.toggle("hidden", desativada);
  // Conta desativada: um rosto triste discreto (entra devagar; parado com reduced-motion).
  doc
    .getElementById("accessRequestIlustracao")
    ?.classList.toggle("hidden", tela?.ilustracao !== "triste");
  const entrar = doc.getElementById("accessRequestEnterBtn");
  if (entrar) {
    const liberado = tela?.acao === "entrar";
    entrar.classList.toggle("hidden", !liberado);
    entrar.onclick = liberado
      ? () => {
          marcarBoasVindasPendentes();
          doc.defaultView?.location.reload();
        }
      : null;
  }
}

/*
  Formulário conforme a situação: editável (sem pedido, recusado), só leitura
  com o pedido enviado (pendente) ou escondido (desativada, liberado).
*/
function aplicarFormulario(doc, tela, solicitacao) {
  const formulario = doc.getElementById("accessRequestForm");
  const botao = doc.getElementById("accessRequestBtn");
  const leitura = tela.formulario === "leitura";
  formulario?.classList.toggle("hidden", tela.formulario === "oculto");
  if (botao) {
    botao.classList.toggle("hidden", tela.acao !== "enviar");
    botao.disabled = tela.acao !== "enviar";
  }
  for (const [id, chave] of Object.entries(CAMPOS)) {
    const campo = doc.getElementById(id);
    if (!campo) continue;
    if (leitura && solicitacao) campo.value = solicitacao[chave] ?? "";
    if (campo.tagName === "SELECT") campo.disabled = leitura;
    else campo.readOnly = leitura;
  }
  if (!leitura) mostrarErros(doc, {});
}

/** O contexto relido tem perfil ativo? (pedido aprovado depois da carga) */
async function temPerfilAtivo(sb) {
  const { data, error } = await sb.rpc(RPC_CONTEXTO);
  return !error && Boolean(normalizePlatformContext(data));
}

/*
  Desenha a situação. Conta desativada deixa a marca por usuário: quando o
  perfil voltar a ficar ativo, o app comemora "Bem-vindo(a) de volta".
*/
function desenhar(doc, tela, solicitacao, usuarioId) {
  mostrarStatus(doc, tela);
  aplicarFormulario(doc, tela, solicitacao);
  if (tela.ilustracao === "triste") lembrarContaDesativada(usuarioId);
}

/** Lê o último pedido, decide a situação e desenha a tela. */
export async function carregarMinhaSolicitacao(
  sb,
  doc = document,
  { usuarioId = null } = {},
) {
  void preencherCoordenacoes(sb, doc);
  const { data, error } = await sb.rpc(RPC_MINHA_SOLICITACAO);
  if (error) {
    const tela = telaDaSolicitacao({ contaDesativada });
    if (contaDesativada) desenhar(doc, tela, null, usuarioId);
    else {
      mostrarStatus(doc, {
        tom: "warn",
        texto:
          "Não foi possível consultar seu pedido anterior. Você pode enviar um pedido agora.",
      });
      aplicarFormulario(doc, tela, null);
    }
    return null;
  }
  const solicitacao = data || null;
  const perfilAtivo =
    !contaDesativada && solicitacao?.status === "aprovado"
      ? await temPerfilAtivo(sb)
      : false;
  desenhar(
    doc,
    telaDaSolicitacao({ solicitacao, contaDesativada, perfilAtivo }),
    solicitacao,
    usuarioId,
  );
  return solicitacao;
}

/**
 * Valida e envia o formulário. Devolve { ok, mensagem, erros }: com erro de
 * campo, nada vai ao banco e cada campo mostra o seu.
 */
export async function enviarSolicitacao(sb, campos, doc = document) {
  const erros = validarSolicitacao(campos);
  mostrarErros(doc, erros);
  if (Object.keys(erros).length) return { ok: false, mensagem: "", erros };
  const { error } = await sb.rpc(
    RPC_REGISTRAR_SOLICITACAO,
    argumentosDaSolicitacao(campos),
  );
  if (error) return { ok: false, mensagem: error.message, erros: {} };
  await carregarMinhaSolicitacao(sb, doc);
  return { ok: true, mensagem: "", erros: {} };
}

// ── Lista administrativa antiga (Configurações) ─────────────────────────────

const ESC_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ESC_MAP[char]);
const attr = (value) => esc(value).replaceAll("`", "&#096;");

function profileOptionsHTML(value) {
  const normalized = normalizeRole({ perfil: value, ativo: true }) || "usuario";
  return ACCESS_ROLES.map(
    (role) =>
      `<option value="${attr(role.value)}" ${normalized === role.value ? "selected" : ""}>${esc(role.label)}</option>`,
  ).join("");
}

export function renderAccessRequestAdminItemHTML(req) {
  const editable = req.status === "pendente";
  const disabled = editable ? "" : "disabled";

  return `<div class="access-admin-item" data-access-request="${attr(req.id)}">
    <div class="access-admin-head">
      <div>
        <strong>${esc(req.nome || req.email)}</strong>
        <span>${esc(req.email)}${req.setor ? " · " + esc(req.setor) : ""}</span>
        ${req.justificativa ? `<span>${esc(req.justificativa)}</span>` : ""}
      </div>
      <div class="access-status-pill ${attr(req.status)}">${esc(req.status)}</div>
    </div>
    <div class="access-admin-controls access-admin-controls--profile-only">
      <div class="form-row">
        <label for="accessPerfil${attr(req.id)}">Perfil</label>
        <select id="accessPerfil${attr(req.id)}" ${disabled}>
          ${profileOptionsHTML(req.perfil_solicitado)}
        </select>
      </div>
    </div>
    <div class="form-row access-admin-observation">
      <label for="accessObs${attr(req.id)}">Observação administrativa</label>
      <input id="accessObs${attr(req.id)}" value="${attr(req.observacao_admin || "")}" placeholder="Opcional" ${disabled}>
    </div>
    <div class="access-admin-actions">
      ${
        editable
          ? `<button class="btn green" type="button" onclick="approveAccessRequest('${attr(req.id)}')"><i class="fa-solid fa-check"></i> Aprovar acesso</button>
      <button class="btn red" type="button" onclick="denyAccessRequest('${attr(req.id)}')"><i class="fa-solid fa-xmark"></i> Recusar</button>`
          : ""
      }
    </div>
  </div>`;
}
