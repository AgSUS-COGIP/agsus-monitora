import type { PontoEditavelIndigena } from "../../lib/tipos-das-coordenadas-do-mapa.ts";
import type {
  FonteDoEditor,
  PropsDoEditor,
} from "../editor-de-coordenadas/tipos.ts";
import type { CorrecaoDoEditor } from "../../lib/tipos-do-editor-de-coordenadas.ts";
import { useMemo } from "react";
import {
  chaveDaPendencia,
  filaDeCoordenadas,
  gravidadeDaPendencia,
  pontosEditaveisDoMapa,
  sugestoesDaPendencia,
} from "../../lib/coordenadas-do-mapa.ts";
import { EditorDeCoordenadas as EditorComum } from "../editor-de-coordenadas/editor-de-coordenadas.tsx";

/*
  O editor de coordenadas do mapa da Saúde Indígena: o editor comum
  (src/modulos/editor-de-coordenadas/) com os pontos do lmap e do rede_cnes
  (visão nacional ou um DSEI), as regras deste mapa
  (src/lib/coordenadas-do-mapa.ts) e as RPCs `*_coordenada_mapa_saude_indigena`
  (migrations 20261002143323 e 20261002160000). A RPC devolve o lmap e o
  rede_cnes novos, que o mapa recebe por `aoAtualizarMapa`.
*/
const RPC_SALVAR = "salvar_coordenada_mapa_saude_indigena";
const RPC_DESFAZER = "desfazer_coordenada_mapa_saude_indigena";
const RPC_PENDENCIAS = "listar_pendencias_coordenada_mapa_saude_indigena";
const RPC_HISTORICO = "listar_historico_coordenada_mapa_saude_indigena";

export const FONTE_DA_SAUDE_INDIGENA: FonteDoEditor<PontoEditavelIndigena> =
  Object.freeze({
    rpc: Object.freeze({
      salvar: RPC_SALVAR,
      desfazer: RPC_DESFAZER,
      pendencias: RPC_PENDENCIAS,
      historico: RPC_HISTORICO,
    }),
    fila: filaDeCoordenadas,
    chaveDoPonto: (ponto: PontoEditavelIndigena) =>
      chaveDaPendencia(ponto.alvo),
    chaveDaPendencia,
    sugestoes: sugestoesDaPendencia,
    gravidade: gravidadeDaPendencia,
    argumentosDoSalvar: ({
      ponto,
      latitude,
      longitude,
      motivo,
      conferir,
    }: Parameters<
      FonteDoEditor<PontoEditavelIndigena>["argumentosDoSalvar"]
    >[0]) => ({
      p_alvo: ponto.alvo,
      p_latitude: latitude,
      p_longitude: longitude,
      p_latitude_anterior: ponto.latitude,
      p_longitude_anterior: ponto.longitude,
      p_motivo: motivo,
      p_conferido: conferir,
    }),
    argumentosDoHistorico: (ponto: PontoEditavelIndigena, limite: number) => ({
      p_alvo: ponto.alvo,
      p_limite: limite,
    }),
    textos: Object.freeze({
      busca: "Nome, CNES, município ou DSEI",
      lista: "Pontos do mapa",
    }),
    detalheDoItem: (item: PontoEditavelIndigena) =>
      [item.alvo?.dsei, item.localidade].filter(Boolean).join(" · "),
  });

export interface PropsDoEditorIndigena extends Omit<
  PropsDoEditor<PontoEditavelIndigena>,
  "pontos" | "fonte" | "aoAtualizarMapa"
> {
  lmap: unknown;
  redeCnes: unknown;
  dsei?: string | null;
  aoAtualizarMapa?(dados: CorrecaoDoEditor): void;
}

export function EditorDeCoordenadas({
  lmap,
  redeCnes,
  dsei,
  aoAtualizarMapa,
  ...resto
}: PropsDoEditorIndigena) {
  const pontos = useMemo(
    () => pontosEditaveisDoMapa(lmap, redeCnes, dsei),
    [lmap, redeCnes, dsei],
  );
  return (
    <EditorComum
      pontos={pontos}
      fonte={FONTE_DA_SAUDE_INDIGENA}
      aoAtualizarMapa={(data) => aoAtualizarMapa?.(data)}
      {...resto}
    />
  );
}
