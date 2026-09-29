/*
  Solicitação de acesso (tela de quem ainda não tem perfil): a mensagem de
  status, a validação e os argumentos de registrar_solicitacao_acesso.
*/

const txt = (valor) => String(valor ?? "").trim();

/** Mensagem de status da solicitação mais recente ({ tone, text } ou null). */
export function mensagemDoStatus(req) {
  if (!req) return null;
  const status = txt(req.status).toLowerCase();
  const onde = req.coordenacao_nome
    ? ` para a coordenação ${req.coordenacao_nome}`
    : "";
  if (status === "pendente")
    return {
      tone: "info",
      text: `Solicitação${onde} enviada. Aguarde a avaliação.`,
    };
  if (status === "aprovado")
    return {
      tone: "success",
      text: "Solicitação aprovada. Recarregue a página para entrar.",
    };
  if (status === "recusado")
    return {
      tone: "warn",
      text: `Solicitação recusada.${req.observacao_admin ? ` Observação: ${txt(req.observacao_admin)}` : ""} Você pode enviar uma nova.`,
    };
  return null;
}

/** Com pendente ou aprovada, o formulário fica travado. */
export function formularioTravado(req) {
  return ["pendente", "aprovado"].includes(txt(req?.status).toLowerCase());
}

/** Erros por campo ({} = válido). */
export function validarSolicitacao({ nome, justificativa }) {
  const erros = {};
  if (txt(nome).length < 2) erros.nome = "Informe seu nome.";
  if (txt(justificativa).length > 2000)
    erros.justificativa = "Justificativa muito longa.";
  return erros;
}

export function argumentosDaSolicitacao({
  nome,
  setor,
  justificativa,
  coordenacao,
}) {
  return {
    p_nome: txt(nome),
    p_setor: txt(setor) || null,
    p_justificativa: txt(justificativa) || null,
    p_coordenacao: txt(coordenacao) || null,
  };
}
