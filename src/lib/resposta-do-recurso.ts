import type { AcaoDaResposta } from "../modulos/recursos/tipos-do-estado.ts";
import type { RespostaDoRecurso } from "./tipos-da-resposta-do-recurso.ts";
import type { IdentificadorDoRecurso } from "./tipos-dos-recursos.ts";
interface RegraDaResposta {
  rotulo: string;
  de: readonly string[];
  para: string;
  comentario: "nao" | "opcional" | "obrigatorio";
  juridico?: boolean;
}
export interface ContextoDaResposta {
  resposta?: Partial<RespostaDoRecurso> | null;
  eu?: IdentificadorDoRecurso | null;
  podeEditar?: boolean;
  podeDecidir?: boolean;
  situacao?: string | null;
  alterada?: boolean;
}
export interface BotaoDaResposta {
  acao: AcaoDaResposta;
  rotulo: string;
  comentario: RegraDaResposta["comentario"];
  permitida: boolean;
  motivo: string;
}
const acaoConhecida = (acao: string): acao is AcaoDaResposta =>
  Object.hasOwn(ACOES_DA_RESPOSTA, acao);
/*
  A resposta escrita a um recurso, sem DOM: os estados, as transições e quem
  pode fazer cada uma. É o espelho das regras de `salvar_resposta_recurso` e
  `transicionar_resposta_recurso`
  (supabase/migrations/20260929230000_recursos_modelos_anexos_respostas.sql):
  o banco confere de novo e é quem decide; aqui é só para a gaveta mostrar o
  botão certo e dizer por que um está desligado.

    rascunho ─salvar→ rascunho          devolvida ─salvar→ rascunho
    rascunho | devolvida ─enviar_revisao→ em_revisao
    rascunho ─aprovar→ aprovada        (revisão opcional; só se nunca foi à revisão
                                        ou se quem aprova não escreveu nem enviou)
    em_revisao ─aprovar→ aprovada      (outra pessoa: nem o autor nem quem enviou)
    em_revisao ─devolver→ devolvida    (com comentário; não pelo autor)
    aprovada ─reabrir→ rascunho        (com comentário)
    aprovada ─marcar_enviada→ enviada  (marca a etapa "resposta enviada" do recurso)

  Aprovar e devolver (a revisão final do texto) são do parecer jurídico
  (`juridico: true`; 20261001170000_recursos_parecer_juridico.sql): quem não
  tem `recursos_parecer` não vê esses botões. Marcar enviada fica com quem
  edita, mas só com o recurso decidido.
*/
import { situacaoDecidida } from "./recursos-dos-candidatos.ts";

export const ESTADOS_DA_RESPOSTA: readonly {
  id: string;
  rotulo: string;
  tom: "neutral" | "warning" | "danger" | "success" | "info";
}[] = Object.freeze([
  Object.freeze({ id: "rascunho", rotulo: "Rascunho", tom: "neutral" }),
  Object.freeze({ id: "em_revisao", rotulo: "Em revisão", tom: "warning" }),
  Object.freeze({ id: "devolvida", rotulo: "Devolvida", tom: "danger" }),
  Object.freeze({ id: "aprovada", rotulo: "Aprovada", tom: "success" }),
  Object.freeze({ id: "enviada", rotulo: "Enviada", tom: "info" }),
]);

export const ACOES_DA_RESPOSTA: Readonly<
  Record<AcaoDaResposta, RegraDaResposta>
> = Object.freeze({
  enviar_revisao: Object.freeze({
    rotulo: "Enviar para revisão",
    de: Object.freeze(["rascunho", "devolvida"]),
    para: "em_revisao",
    comentario: "nao",
  }),
  aprovar: Object.freeze({
    rotulo: "Aprovar",
    de: Object.freeze(["rascunho", "em_revisao"]),
    para: "aprovada",
    comentario: "opcional",
    juridico: true,
  }),
  devolver: Object.freeze({
    rotulo: "Devolver",
    de: Object.freeze(["em_revisao"]),
    para: "devolvida",
    comentario: "obrigatorio",
    juridico: true,
  }),
  reabrir: Object.freeze({
    rotulo: "Reabrir",
    de: Object.freeze(["aprovada"]),
    para: "rascunho",
    comentario: "obrigatorio",
  }),
  marcar_enviada: Object.freeze({
    rotulo: "Marcar resposta enviada",
    de: Object.freeze(["aprovada"]),
    para: "enviada",
    comentario: "nao",
  }),
});

export const rotuloDoEstado = (id: unknown) =>
  ESTADOS_DA_RESPOSTA.find((e) => e.id === id)?.rotulo || "Sem resposta";
export const tomDoEstado = (id: unknown) =>
  ESTADOS_DA_RESPOSTA.find((e) => e.id === id)?.tom || "neutral";

/** O estado depois da ação, ou `null` se a ação não vale a partir dele. */
export function proximoEstado(estado: string, acao: string) {
  const regra = acaoConhecida(acao) ? ACOES_DA_RESPOSTA[acao] : undefined;
  return regra && regra.de.includes(estado) ? regra.para : null;
}

/** O texto (modelo e fundamentação) só muda em rascunho ou devolvida. */
export const podeEditarTexto = (
  resposta: Partial<RespostaDoRecurso> | null | undefined,
) => !resposta || ["rascunho", "devolvida"].includes(resposta.estado ?? "");

const mesmo = (a: unknown, b: unknown) =>
  Boolean(a) && Boolean(b) && String(a) === String(b);

/**
 * Pode fazer `acao`? `{ permitida, motivo }`. `resposta` é a do detalhe
 * (`get_recurso_candidato_detalhe`), `eu` o id de quem usa (o `eu` do
 * detalhe), `situacao` a do recurso, `podeDecidir` = recursos_parecer.
 */
export function avaliarAcao(
  acao: string,
  {
    resposta,
    eu,
    podeEditar,
    podeDecidir = false,
    situacao,
    alterada = false,
  }: ContextoDaResposta = {},
) {
  const regra = acaoConhecida(acao) ? ACOES_DA_RESPOSTA[acao] : undefined;
  if (!regra) return { permitida: false, motivo: "Ação desconhecida." };
  if (!podeEditar)
    return { permitida: false, motivo: "Sem permissão para responder." };
  if (regra.juridico && !podeDecidir)
    return { permitida: false, motivo: "É do parecer jurídico." };
  if (!resposta?.id)
    return { permitida: false, motivo: "Salve o rascunho primeiro." };
  if (!regra.de.includes(resposta.estado ?? ""))
    return {
      permitida: false,
      motivo: `Não se aplica a uma resposta ${rotuloDoEstado(resposta.estado).toLowerCase()}.`,
    };
  if (alterada && ["enviar_revisao", "aprovar"].includes(acao))
    return {
      permitida: false,
      motivo: "Salve as alterações antes.",
    };
  if (acao === "aprovar") {
    const exigeOutraPessoa =
      resposta.estado === "em_revisao" || Boolean(resposta.passou_revisao);
    if (
      exigeOutraPessoa &&
      (mesmo(eu, resposta.autor_id) || mesmo(eu, resposta.envio_revisao_por_id))
    )
      return {
        permitida: false,
        motivo:
          "Quem escreveu ou enviou a resposta para revisão não pode aprová-la.",
      };
    if (!situacaoDecidida(situacao))
      return {
        permitida: false,
        motivo: "Registre a decisão do recurso antes de aprovar a resposta.",
      };
    if (resposta.modelo_situacao && situacao !== resposta.modelo_situacao)
      return {
        permitida: false,
        motivo: "A situação do recurso não é a do modelo usado na resposta.",
      };
  }
  if (acao === "marcar_enviada" && !situacaoDecidida(situacao))
    return {
      permitida: false,
      motivo: "O recurso não está decidido.",
    };
  if (acao === "devolver" && mesmo(eu, resposta.autor_id))
    return {
      permitida: false,
      motivo: "Quem escreveu a resposta não pode devolvê-la.",
    };
  return { permitida: true, motivo: "" };
}

/**
 * As ações que fazem sentido no estado atual, com a avaliação de cada uma.
 * As do parecer jurídico nem aparecem para quem não o tem.
 */
export function acoesDaResposta(
  contexto: ContextoDaResposta = {},
): BotaoDaResposta[] {
  const estado = contexto.resposta?.estado;
  return Object.keys(ACOES_DA_RESPOSTA)
    .filter(acaoConhecida)
    .filter((acao) => estado && ACOES_DA_RESPOSTA[acao].de.includes(estado))
    .filter((acao) => !ACOES_DA_RESPOSTA[acao].juridico || contexto.podeDecidir)
    .map((acao) => ({
      acao,
      rotulo: ACOES_DA_RESPOSTA[acao].rotulo,
      comentario: ACOES_DA_RESPOSTA[acao].comentario,
      ...avaliarAcao(acao, contexto),
    }));
}

/** Comentário da ação: `""` se está bom, senão o erro. */
export function erroDoComentario(acao: string, comentario: unknown) {
  const regra = acaoConhecida(acao) ? ACOES_DA_RESPOSTA[acao] : undefined;
  const valor = String(comentario ?? "").trim();
  if (valor.length > 2000) return "O comentário passa de 2.000 caracteres.";
  if (regra?.comentario === "obrigatorio" && valor.length < 3)
    return acao === "devolver"
      ? "Diga o que precisa ser ajustado."
      : "Informe o motivo.";
  return "";
}
