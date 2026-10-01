/*
  O fluxo do parecer jurídico de um recurso, sem DOM: as transições da
  situação e quem pode fazer cada uma. É o espelho de
  `transicionar_recurso_candidato`
  (supabase/migrations/20261001170000_recursos_parecer_juridico.sql): o banco
  confere de novo e é quem decide; aqui é só para a gaveta mostrar o botão
  certo — e só a quem pode.

    REGISTRADO ─enviar_parecer→ EM_ANALISE_JURIDICA      (quem edita)
    EM_ANALISE_JURIDICA ─devolver→ REGISTRADO             (parecer; comentário)
    EM_ANALISE_JURIDICA ─deferir | deferir_parcialmente | indeferir→ decidido
                                                          (parecer; texto do parecer)
    decidido ─reabrir→ EM_ANALISE_JURIDICA                (parecer; motivo; sem
                                                           resposta enviada)
*/
import {
  SITUACAO_EM_PARECER,
  SITUACAO_INICIAL,
  SITUACOES_DECIDIDAS,
} from "./recursos-dos-candidatos.js";

export const ACOES_DO_PARECER = Object.freeze({
  enviar_parecer: Object.freeze({
    rotulo: "Enviar para parecer jurídico",
    de: Object.freeze([SITUACAO_INICIAL]),
    para: SITUACAO_EM_PARECER,
    texto: "opcional",
    juridico: false,
  }),
  deferir: Object.freeze({
    rotulo: "Deferir",
    de: Object.freeze([SITUACAO_EM_PARECER]),
    para: "DEFERIDO",
    texto: "parecer",
    juridico: true,
  }),
  deferir_parcialmente: Object.freeze({
    rotulo: "Deferir parcialmente",
    de: Object.freeze([SITUACAO_EM_PARECER]),
    para: "PARCIALMENTE_INDEFERIDO",
    texto: "parecer",
    juridico: true,
  }),
  indeferir: Object.freeze({
    rotulo: "Indeferir",
    de: Object.freeze([SITUACAO_EM_PARECER]),
    para: "INDEFERIDO",
    texto: "parecer",
    juridico: true,
  }),
  devolver: Object.freeze({
    rotulo: "Devolver para ajuste",
    de: Object.freeze([SITUACAO_EM_PARECER]),
    para: SITUACAO_INICIAL,
    texto: "obrigatorio",
    juridico: true,
  }),
  reabrir: Object.freeze({
    rotulo: "Reabrir decisão",
    de: SITUACOES_DECIDIDAS,
    para: SITUACAO_EM_PARECER,
    texto: "obrigatorio",
    juridico: true,
  }),
});

/** A situação depois da ação, ou `null` se a ação não vale a partir dela. */
export function proximaSituacao(situacao, acao) {
  const regra = ACOES_DO_PARECER[acao];
  return regra && regra.de.includes(situacao) ? regra.para : null;
}

/**
 * Pode fazer `acao`? `{ permitida, motivo }`. `podeEditar` = Recursos >=
 * editor; `podeDecidir` = recursos_parecer; `respostaEnviada` = a resposta já
 * saiu para o candidato (a decisão não reabre).
 */
export function avaliarAcaoDoParecer(
  acao,
  { situacao, podeEditar = false, podeDecidir = false, respostaEnviada = false } = {},
) {
  const regra = ACOES_DO_PARECER[acao];
  if (!regra) return { permitida: false, motivo: "Ação desconhecida." };
  if (regra.juridico ? !podeDecidir : !podeEditar)
    return { permitida: false, motivo: "Sem permissão." };
  if (!regra.de.includes(situacao))
    return { permitida: false, motivo: "Não se aplica à situação atual." };
  if (acao === "reabrir" && respostaEnviada)
    return {
      permitida: false,
      motivo: "A resposta já foi enviada ao candidato.",
    };
  return { permitida: true, motivo: "" };
}

/**
 * Os botões do fluxo para quem está usando: só as ações que valem na
 * situação e que a pessoa pode fazer (quem não decide não vê deferir,
 * indeferir, devolver nem reabrir).
 */
export function acoesDoParecer(contexto = {}) {
  return Object.entries(ACOES_DO_PARECER)
    .map(([acao, regra]) => ({
      acao,
      rotulo: regra.rotulo,
      texto: regra.texto,
      ...avaliarAcaoDoParecer(acao, contexto),
    }))
    .filter((a) => a.permitida || a.motivo.startsWith("A resposta"))
    .filter((a) => {
      const regra = ACOES_DO_PARECER[a.acao];
      return regra.juridico ? contexto.podeDecidir : contexto.podeEditar;
    });
}

/** Em análise jurídica, para quem não decide: o aviso no lugar dos botões. */
export const aguardandoParecer = (situacao, podeDecidir) =>
  situacao === SITUACAO_EM_PARECER && !podeDecidir;

export const LIMITES_DO_PARECER = Object.freeze({
  parecer: Object.freeze({ minimo: 10, maximo: 20000 }),
  obrigatorio: Object.freeze({ minimo: 3, maximo: 2000 }),
  opcional: Object.freeze({ minimo: 0, maximo: 2000 }),
});

/** Texto da ação (parecer, comentário ou observação): `""` se está bom, senão o erro. */
export function erroDoTextoDoParecer(acao, texto) {
  const regra = ACOES_DO_PARECER[acao];
  if (!regra) return "Ação desconhecida.";
  const { minimo, maximo } = LIMITES_DO_PARECER[regra.texto];
  const valor = String(texto ?? "").trim();
  if (valor.length > maximo)
    return `O texto passa de ${maximo.toLocaleString("pt-BR")} caracteres.`;
  if (valor.length < minimo)
    return regra.texto === "parecer"
      ? "Escreva o parecer jurídico (10 caracteres ou mais)."
      : acao === "devolver"
        ? "Diga o que precisa ser ajustado."
        : "Informe o motivo.";
  return "";
}
