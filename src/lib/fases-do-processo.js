/*
  As FASES do processo seletivo na Visão geral, sem DOM.

  A etapa de cada edital é o nome livre da atividade do cronograma
  (`TB_CRONOGRAMA_MONIT_INDIG.atividade`, via `etapa` e
  `cronograma_atividade_atual` da linha): cada edital escreve do seu jeito
  ("Período de inscrição", "Inscrições", "Resultado Preliminar da análise
  curricular e abertura do prazo de recurso", "Resposta aos Recursos e
  Resultado Final das Entrevistas", "Resultado final do processo seletivo "
  com espaço no fim, "Aguardando: Entrevistas"…). Aqui o texto vira uma fase
  fixa, na ordem do processo:

    Edital → Inscrições → Análise curricular → Recursos → Entrevistas →
    Resultado → Contratação → Concluído

  e, fora do fluxo, Cancelado, Sem cronograma e Outra (texto que nenhuma
  regra reconhece, como "zzzzz").

  O status manda antes do texto: cancelado é Cancelado, concluído (o
  cronograma terminou) é Concluído e planejado (antes da primeira atividade) é
  Edital. "Aguardando: X" conta como a fase de X.
*/

export const FASES = Object.freeze([
  "Edital",
  "Inscrições",
  "Análise curricular",
  "Recursos",
  "Entrevistas",
  "Resultado",
  "Contratação",
  "Concluído",
]);
export const FASES_FORA_DO_FLUXO = Object.freeze([
  "Cancelado",
  "Sem cronograma",
  "Outra",
]);
export const ORDEM_DAS_FASES = Object.freeze([
  ...FASES,
  ...FASES_FORA_DO_FLUXO,
]);

/** Minúsculas, sem acento, só letras/números e espaço simples. */
export function normalizarAtividade(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CONTRATACAO =
  /\b(admiss\w*|contrata\w*|posse|exames? admissiona\w*|assinatura|entrega de documentos|inicio das atividades)\b/;
const PRAZO_DE_RECURSO =
  /\b(prazo|interposi\w*|abertura|recebimento|apresentacao)\b/;
const RESULTADO_FINAL =
  /\b(resultado final|homologacao (do |de )?resultado|homologacao final)\b/;
const ANALISE =
  /\b(analise|curricul\w*|documental|titulos|triagem|avaliacao|prova\w*|conhecimentos?|resultado preliminar|classificacao preliminar|heteroidentifica\w*)\b/;
const EDITAL = /\b(edital|impugna\w*|elabora\w*|publicacao)\b/;

/**
 * A fase de um texto de atividade; `null` para texto vazio.
 * A ordem das regras importa: "Resultado final das entrevistas" é Resultado,
 * "Convocação para entrevista" é Entrevistas e "Prazo de recurso do resultado
 * final" é Recursos.
 */
export function faseDaAtividade(texto) {
  const t = normalizarAtividade(texto).replace(/^aguardando\s+/, "");
  if (!t) return null;
  if (t.includes("cronograma pendente")) return "Sem cronograma";
  const recurso = /\brecurs\w*/.test(t);
  if (CONTRATACAO.test(t)) return "Contratação";
  if (recurso && PRAZO_DE_RECURSO.test(t)) return "Recursos";
  if (RESULTADO_FINAL.test(t)) return "Resultado";
  if (recurso) return "Recursos";
  if (/\bentrevist\w*/.test(t)) return "Entrevistas";
  if (ANALISE.test(t)) return "Análise curricular";
  if (/\binscri\w*/.test(t)) return "Inscrições";
  if (/\bresultado\b/.test(t)) return "Resultado";
  if (EDITAL.test(t)) return "Edital";
  return "Outra";
}

const status = (linha) => normalizarAtividade(linha?.status);

/** A fase do edital: o status primeiro, depois a atividade do cronograma. */
export function faseDoEdital(linha) {
  const s = status(linha);
  if (s.includes("cancel")) return "Cancelado";
  if (s.includes("conclu")) return "Concluído";
  if (s.includes("planejad")) return "Edital";
  const atividade =
    String(linha?.cronograma_atividade_atual ?? "").trim() ||
    String(linha?.etapa ?? "").trim();
  return faseDaAtividade(atividade) || "Sem cronograma";
}

/** O tom de cada fase (cor dos tokens). */
export function tomDaFase(fase) {
  switch (fase) {
    case "Inscrições":
    case "Entrevistas":
      return "info";
    case "Análise curricular":
      return "destaque";
    case "Recursos":
    case "Resultado":
      return "alerta";
    case "Contratação":
    case "Concluído":
      return "sucesso";
    case "Cancelado":
      return "perigo";
    default:
      return "neutro";
  }
}
