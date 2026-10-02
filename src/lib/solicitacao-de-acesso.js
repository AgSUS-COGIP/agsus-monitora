/*
  Solicitação de acesso (tela de quem entrou com Google e não tem perfil
  ativo): em que situação a pessoa está, o que a tela mostra, a validação e os
  argumentos de registrar_solicitacao_acesso. Sem DOM; o estado do cartão é de
  src/app/entrada/pedido-de-acesso.js e o desenho, de pedido-de-acesso.jsx.

  De onde vem cada situação (só dados que o banco já expõe):
    - obter_minha_solicitacao_acesso → o pedido mais recente (ou null);
    - minha_conta_desativada → true quando a conta existe no MONITORA e está
      desativada. O acesso é só por convite: o front não cria acesso básico
      (garantir_acesso_basico saiu do front em 01/10/2026);
    - pedido "aprovado" sem perfil ativo: foi aprovado e o acesso saiu depois
      (desativado). Com perfil ativo (o contexto relido achou), é "liberado".

  Conta desativada pode pedir REATIVAÇÃO (o mesmo registrar_solicitacao_acesso,
  só nome e justificativa obrigatórios). Com o pedido pendente, a tela segue
  "Acesso desativado" e diz que o pedido de reativação aguarda um
  administrador.
*/

const txt = (valor) => String(valor ?? "").trim();

export const SITUACOES = Object.freeze({
  SEM_PEDIDO: "sem_pedido",
  PENDENTE: "pendente",
  RECUSADO: "recusado",
  DESATIVADA: "desativada",
  REATIVACAO_PENDENTE: "reativacao_pendente",
  LIBERADO: "liberado",
});

export const NOME_MINIMO = 2;
export const JUSTIFICATIVA_MINIMA = 20;
export const JUSTIFICATIVA_MAXIMA = 2000;
export const SETOR_MAXIMO = 200;

export const TEXTO_DO_CONVITE =
  "Se você recebeu um convite, entre com o e-mail convidado.";
export const TITULO_DESATIVADA = "Seu acesso ao MONITORA foi desativado.";
export const TEXTO_DESATIVADA =
  "Se acha que é um engano, fale com a equipe responsável pelo MONITORA.";
export const PERGUNTA_DA_REATIVACAO = "Precisa do acesso de novo?";

const FORMATO_DIA_E_MES = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "2026-09-29T13:00:00Z" → "29/09" ("" se não for data). */
export function diaEMes(valor) {
  if (!valor) return "";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "" : FORMATO_DIA_E_MES.format(data);
}

/**
 * Situação da tela, a partir do pedido mais recente, da conta desativada e de
 * haver (agora) perfil ativo. Desativada vence tudo: um pedido antigo
 * aprovado não pode dizer "aprovada" para quem foi desligado. A exceção é o
 * pedido pendente da conta desativada: é o pedido de reativação.
 */
export function situacaoDaSolicitacao({
  solicitacao = null,
  contaDesativada = false,
  perfilAtivo = false,
} = {}) {
  const status = txt(solicitacao?.status).toLowerCase();
  if (contaDesativada)
    return status === "pendente"
      ? SITUACOES.REATIVACAO_PENDENTE
      : SITUACOES.DESATIVADA;
  if (perfilAtivo) return SITUACOES.LIBERADO;
  if (status === "pendente") return SITUACOES.PENDENTE;
  if (status === "recusado") return SITUACOES.RECUSADO;
  if (status === "aprovado") return SITUACOES.DESATIVADA;
  return SITUACOES.SEM_PEDIDO;
}

/**
 * O que a tela mostra em cada situação:
 *   { situacao, tom, titulo, texto, formulario, acao, ilustracao,
 *     desativada, reativacao }
 *   tom        "info" | "success" | "warn" | "danger" | ""
 *   formulario "editavel" | "leitura" (mostra o pedido enviado) | "oculto"
 *   acao       "enviar" | "entrar" | null
 *   ilustracao "triste" (conta desativada) | null
 *   desativada a conta está desativada (o cartão diz "Acesso desativado")
 *   reativacao "oferecer" (botão "Pedir reativação") | "pendente" | null
 */
export function telaDaSolicitacao(dados = {}) {
  const situacao = situacaoDaSolicitacao(dados);
  const req = dados.solicitacao || null;
  const onde = req?.coordenacao_nome
    ? ` para a coordenação ${txt(req.coordenacao_nome)}`
    : "";
  if (situacao === SITUACOES.DESATIVADA)
    return {
      situacao,
      tom: "danger",
      titulo: TITULO_DESATIVADA,
      texto: TEXTO_DESATIVADA,
      formulario: "oculto",
      acao: null,
      ilustracao: "triste",
      desativada: true,
      reativacao: "oferecer",
    };
  if (situacao === SITUACOES.REATIVACAO_PENDENTE) {
    const dia = diaEMes(req?.created_at);
    return {
      situacao,
      tom: "info",
      titulo: TITULO_DESATIVADA,
      texto: `Pedido de reativação enviado${dia ? ` em ${dia}` : ""}, aguardando um administrador.`,
      formulario: "leitura",
      acao: null,
      ilustracao: null,
      desativada: true,
      reativacao: "pendente",
    };
  }
  if (situacao === SITUACOES.LIBERADO)
    return {
      situacao,
      tom: "success",
      titulo: "Acesso liberado",
      texto: "Seu acesso ao MONITORA está liberado.",
      formulario: "oculto",
      acao: "entrar",
    };
  if (situacao === SITUACOES.PENDENTE) {
    const dia = diaEMes(req?.created_at);
    return {
      situacao,
      tom: "info",
      titulo: "Pedido enviado",
      texto: `Pedido enviado${dia ? ` em ${dia}` : ""}${onde}, aguardando um administrador.`,
      formulario: "leitura",
      acao: null,
    };
  }
  if (situacao === SITUACOES.RECUSADO) {
    const dia = diaEMes(req?.avaliado_em);
    const nota = txt(req?.observacao_admin);
    return {
      situacao,
      tom: "warn",
      titulo: "Pedido recusado",
      texto: `Pedido recusado${dia ? ` em ${dia}` : ""}.${nota ? ` Observação: ${nota}` : ""} Você pode enviar um novo pedido.`,
      formulario: "editavel",
      acao: "enviar",
    };
  }
  return {
    situacao,
    tom: "",
    titulo: "",
    texto: "",
    formulario: "editavel",
    acao: "enviar",
  };
}

/**
 * Erros por campo ({} = válido). Nome e justificativa são obrigatórios; área
 * / setor ou coordenação, ao menos um (o administrador precisa saber onde a
 * pessoa trabalha). No pedido de reativação, o administrador já sabe (o
 * grupo e as áreas de antes): coordenação é opcional e não há setor.
 */
export function validarSolicitacao(
  { nome, setor, coordenacao, justificativa } = {},
  { reativacao = false } = {},
) {
  const erros = {};
  if (txt(nome).length < NOME_MINIMO) erros.nome = "Informe seu nome.";
  if (!reativacao && txt(setor).length > SETOR_MAXIMO)
    erros.setor = `Use no máximo ${SETOR_MAXIMO} caracteres.`;
  else if (!reativacao && !txt(setor) && !txt(coordenacao))
    erros.setor = "Informe sua área / setor ou escolha a coordenação.";
  const tamanho = txt(justificativa).length;
  if (!tamanho) erros.justificativa = "Explique por que precisa do acesso.";
  else if (tamanho < JUSTIFICATIVA_MINIMA)
    erros.justificativa = `Escreva ao menos ${JUSTIFICATIVA_MINIMA} caracteres (faltam ${JUSTIFICATIVA_MINIMA - tamanho}).`;
  else if (tamanho > JUSTIFICATIVA_MAXIMA)
    erros.justificativa = `Use no máximo ${JUSTIFICATIVA_MAXIMA} caracteres.`;
  return erros;
}

export function argumentosDaSolicitacao(
  { nome, setor, justificativa, coordenacao },
  { reativacao = false } = {},
) {
  return {
    p_nome: txt(nome),
    p_setor: reativacao ? null : txt(setor) || null,
    p_justificativa: txt(justificativa) || null,
    p_coordenacao: txt(coordenacao) || null,
  };
}
