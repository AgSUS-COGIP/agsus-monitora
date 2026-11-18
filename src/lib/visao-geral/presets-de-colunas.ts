/*
  Conjuntos prontos de colunas da tabela da Visão geral (revisão de
  17/11/2026): "Gestão", "Prazos" e "Contratação". Um clique troca as colunas
  visíveis; o seletor "Colunas" continua para ajustar uma a uma, e Unidade e
  Edital (as colunas presas à esquerda) estão em todos. A ordem é sempre a
  da tabela (`COLUNAS_PADRAO`).
*/
import type { ColunaDaTabela } from "../../modulos/visao-geral/tipos.ts";
import { COLUNAS_PADRAO } from "./visao-geral.ts";

export type PresetDeColunas = "gestao" | "prazos" | "contratacao";

const FIXAS: readonly ColunaDaTabela[] = ["unidade", "edital"];

export const PRESETS_DE_COLUNAS: readonly {
  id: PresetDeColunas;
  rotulo: string;
  colunas: readonly ColunaDaTabela[];
}[] = Object.freeze([
  Object.freeze({
    id: "gestao",
    rotulo: "Gestão",
    colunas: Object.freeze<ColunaDaTabela[]>([
      "vagas_total",
      "contratados",
      "vagas_ociosas",
      "status",
      "fase",
      "atencao",
    ]),
  }),
  Object.freeze({
    id: "prazos",
    rotulo: "Prazos",
    colunas: Object.freeze<ColunaDaTabela[]>([
      "ciclo",
      "data_inicio",
      "data_fim",
      "duracao",
      "status",
      "fase",
    ]),
  }),
  Object.freeze({
    id: "contratacao",
    rotulo: "Contratação",
    colunas: Object.freeze<ColunaDaTabela[]>([
      "vagas_total",
      "inscritos",
      "aprovados",
      "cadastro_reserva",
      "contratados",
      "vagas_ociosas",
      "primeira_admissao",
      "ultima_admissao",
    ]),
  }),
]);

/** As colunas do conjunto, na ordem da tabela, com as fixas; desconhecido → null. */
export function colunasDoPreset(id: unknown): ColunaDaTabela[] | null {
  const preset = PRESETS_DE_COLUNAS.find((p) => p.id === id);
  if (!preset) return null;
  const escolhidas = new Set<ColunaDaTabela>([...FIXAS, ...preset.colunas]);
  return COLUNAS_PADRAO.filter((campo) => escolhidas.has(campo));
}

/** O conjunto que as colunas visíveis formam (mesmas colunas), ou "". */
export function presetDasColunas(
  colunas: readonly ColunaDaTabela[] | null | undefined,
): PresetDeColunas | "" {
  const atuais = new Set(colunas || []);
  for (const { id } of PRESETS_DE_COLUNAS) {
    const doPreset = colunasDoPreset(id) || [];
    if (
      doPreset.length === atuais.size &&
      doPreset.every((campo) => atuais.has(campo))
    )
      return id;
  }
  return "";
}
