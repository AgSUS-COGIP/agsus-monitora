/*
  Reinício das fichas do edital com dois administradores globais (migration
  20261022210000_reinicio_das_fichas_com_dois_administradores.sql).

  Edital com ficha concluída ou em análise com lançamento: o administrador A
  pede (motivo + o número do edital digitado), outro administrador B aprova
  (também digitando o número) e só então o reinício roda; A pode cancelar, B
  pode recusar; o pedido vale 24 h. Edital sem ficha trabalhada segue com um
  administrador (reiniciar_fichas_do_edital). Edital congelado ou encerrado:
  ninguém reinicia. Aqui só a leitura da resposta do banco e as regras da
  tela; a tela é src/modulos/avaliacao-documental/reinicio-das-fichas.tsx.
*/

import { motivoPareceTexto, textoLimpo } from "./qualidade-do-motivo.ts";

export const RPC_OBTER_REINICIO = "obter_reinicio_fichas_do_edital";
export const RPC_PEDIR_REINICIO = "pedir_reinicio_fichas_do_edital";
export const RPC_APROVAR_REINICIO = "aprovar_reinicio_fichas_do_edital";
export const RPC_RECUSAR_REINICIO = "recusar_reinicio_fichas_do_edital";
export const RPC_CANCELAR_REINICIO = "cancelar_reinicio_fichas_do_edital";

/** Motivo do pedido: 10 a 1.000 caracteres e 3 palavras (o banco confere igual). */
export const MOTIVO_DO_PEDIDO = Object.freeze({
  minimo: 10,
  maximo: 1000,
  palavras: 3,
});

export interface ImpactoDoReinicio {
  concluidas: number;
  emAnalise: number;
  comLancamento: number;
  iniciadas: number;
  exigeAprovacao: boolean;
}

export interface PedidoDeReinicio {
  id: number;
  vencido: boolean;
  motivo: string;
  por: string;
  meu: boolean;
  em: Date | null;
  validade: Date | null;
  concluidas: number;
  emAnalise: number;
}

export type TipoDoEventoDoReinicio =
  "PEDIR" | "CANCELAR" | "RECUSAR" | "APROVAR" | "EXECUTAR" | "VENCER";

export interface EventoDoReinicio {
  pedido: number;
  tipo: TipoDoEventoDoReinicio;
  em: Date | null;
  por: string;
  motivo: string;
  reiniciadas: number | null;
}

export interface ReinicioDasFichas {
  numero: string;
  impacto: ImpactoDoReinicio;
  bloqueio: string;
  pedido: PedidoDeReinicio | null;
  historico: EventoDoReinicio[];
}

const TIPOS: readonly TipoDoEventoDoReinicio[] = [
  "PEDIR",
  "CANCELAR",
  "RECUSAR",
  "APROVAR",
  "EXECUTAR",
  "VENCER",
];

const registro = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const texto = (v: unknown): string =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";

const inteiro = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
};

const data = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function lerPedido(entrada: unknown): PedidoDeReinicio | null {
  const p = registro(entrada);
  const id = inteiro(p.id);
  if (!id || p.situacao !== "PENDENTE") return null;
  const impacto = registro(p.impacto);
  return {
    id,
    vencido: p.vencido === true,
    motivo: texto(p.motivo),
    por: texto(p.por),
    meu: p.meu === true,
    em: data(p.em),
    validade: data(p.validade),
    concluidas: inteiro(impacto.concluidas),
    emAnalise: inteiro(impacto.em_analise),
  };
}

/** A resposta de obter/pedir/recusar/cancelar em formato seguro. */
export function lerReinicio(entrada: unknown): ReinicioDasFichas {
  const r = registro(entrada);
  const i = registro(r.impacto);
  const historico = (Array.isArray(r.historico) ? r.historico : [])
    .map(registro)
    .filter((h) => TIPOS.includes(h.tipo as TipoDoEventoDoReinicio))
    .map((h) => ({
      pedido: inteiro(h.pedido),
      tipo: h.tipo as TipoDoEventoDoReinicio,
      em: data(h.em),
      por: texto(h.por),
      motivo: texto(h.motivo),
      reiniciadas:
        h.reiniciadas === null || h.reiniciadas === undefined
          ? null
          : inteiro(h.reiniciadas),
    }));
  return {
    numero: texto(r.numero),
    impacto: {
      concluidas: inteiro(i.concluidas),
      emAnalise: inteiro(i.em_analise),
      comLancamento: inteiro(i.com_lancamento),
      iniciadas: inteiro(i.iniciadas),
      exigeAprovacao: i.exige_aprovacao === true,
    },
    bloqueio: texto(r.bloqueio),
    pedido: lerPedido(r.pedido),
    historico,
  };
}

/** O pedido que espera a aprovação de quem lê (de outro administrador, dentro da validade). */
export const pedidoParaAprovar = (
  r: ReinicioDasFichas | null,
): PedidoDeReinicio | null =>
  r?.pedido && !r.pedido.meu && !r.pedido.vencido ? r.pedido : null;

/** O que a tela oferece agora. */
export type ModoDoReinicio =
  "bloqueado" | "aprovar" | "aguardando" | "pedir" | "direto" | "nada";

export function modoDoReinicio(r: ReinicioDasFichas): ModoDoReinicio {
  if (r.bloqueio) return "bloqueado";
  if (r.pedido && !r.pedido.vencido)
    return r.pedido.meu ? "aguardando" : "aprovar";
  if (!r.impacto.iniciadas) return "nada";
  return r.impacto.exigeAprovacao ? "pedir" : "direto";
}

/** O número digitado confere com o do edital? ("0114 / 2026" = "114/2026"). */
export function numeroConfere(digitado: unknown, numero: string): boolean {
  const normalizar = (v: unknown) => {
    const t = textoLimpo(v).toLowerCase();
    const m = /(\d{1,4})\s*\/\s*(\d{4})/.exec(t);
    return m?.[1] && m[2] ? `${m[1].replace(/^0+/, "")}/${m[2]}` : t;
  };
  const alvo = normalizar(numero);
  return Boolean(alvo) && normalizar(digitado) === alvo;
}

/** "" quando o motivo do pedido serve; senão a frase curta do erro. */
export function erroDoMotivoDoPedido(motivo: unknown): string {
  const limpo = textoLimpo(motivo);
  if (
    limpo.length < MOTIVO_DO_PEDIDO.minimo ||
    limpo.length > MOTIVO_DO_PEDIDO.maximo
  )
    return "De 10 a 1.000 caracteres.";
  if (!motivoPareceTexto(limpo, MOTIVO_DO_PEDIDO.palavras))
    return "Escreva o motivo com pelo menos 3 palavras.";
  return "";
}

/** "1.509 concluídas e 12 em análise" — o resumo do impacto. */
export function textoDoImpacto(concluidas: number, emAnalise: number): string {
  const n = (v: number) => v.toLocaleString("pt-BR");
  return `${n(concluidas)} concluída${concluidas === 1 ? "" : "s"} e ${n(emAnalise)} em análise`;
}

const ROTULOS: Readonly<Record<TipoDoEventoDoReinicio, string>> = Object.freeze(
  {
    PEDIR: "Pediu",
    CANCELAR: "Cancelou",
    RECUSAR: "Recusou",
    APROVAR: "Aprovou",
    EXECUTAR: "Reiniciou",
    VENCER: "Venceu",
  },
);

/** "Pedido 3 · Aprovou em 22/10 por Fulano" — para o histórico. */
export function textoDoEventoDoReinicio(e: EventoDoReinicio): string {
  const quando = e.em
    ? e.em.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "";
  const base = [
    `Pedido ${e.pedido}`,
    "·",
    ROTULOS[e.tipo],
    quando ? `em ${quando}` : "",
    e.por ? `por ${e.por}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (e.tipo === "EXECUTAR" && e.reiniciadas !== null)
    return `${base}: ${e.reiniciadas} ficha(s)`;
  return e.motivo ? `${base}: ${e.motivo}` : base;
}

/** O erro do banco em frase curta (a função ausente = migration não aplicada). */
export function mensagemDoErroDoReinicio(erro: unknown): string {
  const e = registro(erro);
  if (e.code === "PGRST202")
    return "O banco ainda não tem o reinício com dois administradores (migration 20261022210000).";
  return texto(e.message) || "Não consegui concluir o reinício.";
}
