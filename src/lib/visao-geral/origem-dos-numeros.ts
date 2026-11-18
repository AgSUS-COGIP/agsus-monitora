/*
  De onde vem cada número da linha da Visão geral (revisão de 17/11/2026:
  "cada número leva aos dados que o compõem", como o "Ver a composição" do
  SIGEPSI). A linha é do edital: o destino é a tela do módulo já recortada
  pelo edital (e pelo recorte do número), nunca um código de vaga.

  - Aprovados, Contratados e Aguardando chamada → Lista de aprovados
    (`approved`) no edital; Contratados com o status Contratado/Migração (a
    conta do banco, FC_ATUALIZAR_CONTRATADOS_DO_EDITAL), Aguardando chamada
    com "Sem status".
  - Inscritos → a tela da fonte do funil (`TP_FONTE_FUNIL`): Seleção ou
    Análises curriculares.
  - Só há o total, sem os registros (contratados sem lista vigente, inscritos
    de outra fonte): "agregada". A tela diz "Origem agregada; detalhe
    individual não disponível", nunca abre uma lista vazia.
  - Sem número, zero ou o acompanhamento ainda não chegou: "nenhuma".

  Quem navega é a tela (pedido de filtro + irParaTela); aqui, só a regra.
*/
import { temNumero } from "./indicadores-do-monitoramento.ts";

export type CampoComOrigem =
  "aprovados" | "contratados" | "cadastro_reserva" | "inscritos";

export type TelaDeOrigem = "approved" | "selecao" | "analises";

/** O pedido de filtro que a tela de destino entende (pedido-de-filtro.ts). */
export type PedidoDaOrigem = {
  edital: string;
  editalId?: string;
  metrica?: "aprovados" | "contratados" | "aguardandoChamada";
};

export type OrigemDoNumero =
  | { tipo: "tela"; view: TelaDeOrigem; rotulo: string; pedido: PedidoDaOrigem }
  | { tipo: "agregada" }
  | { tipo: "nenhuma" };

export const TEXTO_DA_ORIGEM_AGREGADA =
  "Origem agregada; detalhe individual não disponível";

type LinhaComOrigem = {
  id?: unknown;
  edital?: unknown;
  aprovados?: unknown;
  contratados?: unknown;
  cadastro_reserva?: unknown;
  inscritos?: unknown;
  TP_FONTE_FUNIL?: unknown;
};

const ROTULO_DA_TELA: Readonly<Record<TelaDeOrigem, string>> = Object.freeze({
  approved: "Abrir na Lista de aprovados",
  selecao: "Abrir na Seleção",
  analises: "Abrir nas Análises curriculares",
});

const METRICA: Readonly<
  Record<
    Exclude<CampoComOrigem, "inscritos">,
    NonNullable<PedidoDaOrigem["metrica"]>
  >
> = Object.freeze({
  aprovados: "aprovados",
  contratados: "contratados",
  cadastro_reserva: "aguardandoChamada",
});

const TELA_DA_FONTE: Readonly<Record<string, TelaDeOrigem>> = Object.freeze({
  SELECAO: "selecao",
  ANALISES: "analises",
});

const positivo = (valor: unknown) => temNumero(valor) && Number(valor) > 0;
const txt = (valor: unknown) => String(valor ?? "").trim();

const tela = (view: TelaDeOrigem, pedido: PedidoDaOrigem): OrigemDoNumero => ({
  tipo: "tela",
  view,
  rotulo: ROTULO_DA_TELA[view],
  pedido,
});

/**
 * A origem do número `campo` da linha. `comListas`: o acompanhamento já
 * trouxe os resumos das listas (sem ele, não dá para saber se há lista).
 */
export function origemDoNumero(
  linha: LinhaComOrigem | null | undefined,
  campo: CampoComOrigem,
  { comListas = false }: { comListas?: boolean } = {},
): OrigemDoNumero {
  if (!linha || !positivo(linha[campo])) return { tipo: "nenhuma" };
  const edital = txt(linha.edital);
  if (campo === "inscritos") {
    const view = TELA_DA_FONTE[txt(linha.TP_FONTE_FUNIL)];
    return view ? tela(view, { edital }) : { tipo: "agregada" };
  }
  // Aprovados e Aguardando chamada só têm número com a lista vigente.
  const temLista = temNumero(linha.aprovados);
  if (campo === "contratados" && !temLista)
    return comListas ? { tipo: "agregada" } : { tipo: "nenhuma" };
  const editalId = txt(linha.id);
  return tela("approved", {
    edital,
    ...(editalId ? { editalId } : {}),
    metrica: METRICA[campo],
  });
}
