import type {
  PontoEditavelDoProjeto,
  PropsDoEditorDeProjetos,
} from "./tipos.ts";
import { useMemo } from "react";
import {
  chaveDaPendenciaDoLugar,
  filaDeCoordenadasDosProjetos,
  gravidadeDoLugar,
  pontosEditaveisDosProjetos,
  REGRAS_DA_FILA_DOS_PROJETOS,
  sugestoesDoLugar,
} from "../../lib/coordenadas-dos-projetos.js";
import { EditorDeCoordenadas } from "../editor-de-coordenadas/editor-de-coordenadas.jsx";

/*
  O editor de coordenadas do mapa de Projetos: o editor comum
  (src/modulos/editor-de-coordenadas/) com os lugares das vagas (a chave
  `lugar` e a coordenada do banco que a RPC do mapa devolve), as regras deste
  mapa (src/lib/coordenadas-dos-projetos.js) e as RPCs
  `*_coordenada_mapa_projetos` (migration 20261002190000). A gravação devolve
  { lugar, latitude, longitude, conferido }, que o mapa aplica por
  `aoAtualizarMapa(data, ponto)`.
*/
const RPC_SALVAR = "salvar_coordenada_mapa_projetos";
const RPC_DESFAZER = "desfazer_coordenada_mapa_projetos";
const RPC_PENDENCIAS = "listar_pendencias_coordenada_mapa_projetos";
const RPC_HISTORICO = "listar_historico_coordenada_mapa_projetos";

export const FONTE_DE_PROJETOS = Object.freeze({
  rpc: Object.freeze({
    salvar: RPC_SALVAR,
    desfazer: RPC_DESFAZER,
    pendencias: RPC_PENDENCIAS,
    historico: RPC_HISTORICO,
  }),
  fila: filaDeCoordenadasDosProjetos,
  chaveDoPonto: REGRAS_DA_FILA_DOS_PROJETOS.chaveDoPonto,
  chaveDaPendencia: chaveDaPendenciaDoLugar,
  sugestoes: sugestoesDoLugar,
  gravidade: gravidadeDoLugar,
  pendenteSemPendencia: REGRAS_DA_FILA_DOS_PROJETOS.pendenteSemPendencia,
  argumentosDoSalvar: ({
    ponto,
    latitude,
    longitude,
    motivo,
    conferir,
  }: {
    ponto: PontoEditavelDoProjeto;
    latitude: number;
    longitude: number;
    motivo: string;
    conferir: boolean;
  }) => ({
    p_lugar: ponto.alvo.lugar,
    p_latitude: latitude,
    p_longitude: longitude,
    p_latitude_anterior: ponto.latitude,
    p_longitude_anterior: ponto.longitude,
    p_motivo: motivo,
    p_conferido: conferir,
  }),
  argumentosDoHistorico: (ponto: PontoEditavelDoProjeto, limite: number) => ({
    p_lugar: ponto.alvo.lugar,
    p_limite: limite,
  }),
  textos: Object.freeze({
    busca: "Lugar, município, UF, projeto ou edital",
    lista: "Lugares do mapa",
  }),
  detalheDoItem: (item: PontoEditavelDoProjeto) =>
    [item.nivel === "uf" ? "" : item.uf, item.localidade]
      .filter(Boolean)
      .join(" · "),
});

export function EditorDeCoordenadasDosProjetos({
  municipios,
  ...resto
}: PropsDoEditorDeProjetos) {
  const pontos = useMemo(
    () => pontosEditaveisDosProjetos(municipios),
    [municipios],
  );
  return (
    <EditorDeCoordenadas pontos={pontos} fonte={FONTE_DE_PROJETOS} {...resto} />
  );
}
