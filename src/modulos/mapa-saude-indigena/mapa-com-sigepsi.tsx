import { useMemo } from "react";
import type { PropsDoMapaSaudeIndigena } from "../../lib/mapa-saude-indigena/tipos.ts";
import {
  aplicarCasaisDoSigepsi,
  aplicarLocalizacoes,
} from "../../lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts";
import { usarLocalizacoesDoSigepsi } from "./localizacoes.ts";
import { MapaSaudeIndigena } from "./mapa-saude-indigena.tsx";

/*
  O mapa da Saúde Indígena com os dados do SIGEPSI por cima dos do banco: a
  lista de DSEIs, as sedes, os pontos e as CASAIs são os do SIGEPSI; do `lmap`
  do banco vêm população e UFs, e do `rede_cnes` as unidades do CNES que não
  são CASAI. Enquanto o SIGEPSI não responde, o mapa espera (não mostra o
  banco para trocá-lo em seguida); sem SIGEPSI, fica o banco.

  Mora no pedaço do mapa (baixado sob demanda por
  src/modulos/visao-geral/mapas-sob-demanda.tsx), não na entrada: a Visão
  geral só passa o `lmap` e o `rede_cnes` do banco (17/11/2026, a entrada
  passava do orçamento de 320 KB gzip).
*/
export function MapaSaudeIndigenaComSigepsi({
  lmap: lmapDoBanco,
  redeCnes: redeDoBanco,
  supabase = null,
  ...resto
}: PropsDoMapaSaudeIndigena) {
  const localizacoes = usarLocalizacoesDoSigepsi(supabase);
  const esperando = localizacoes.estado === "carregando";
  const dados = localizacoes.dados;
  const lmap = useMemo(
    () => (esperando ? null : aplicarLocalizacoes(lmapDoBanco, dados?.dseis)),
    [esperando, lmapDoBanco, dados],
  );
  const redeCnes = useMemo(
    () => aplicarCasaisDoSigepsi(redeDoBanco, dados?.casaisNacionais),
    [redeDoBanco, dados],
  );
  return (
    <MapaSaudeIndigena
      {...resto}
      supabase={supabase}
      lmap={lmap}
      redeCnes={redeCnes}
      carregando={!lmap}
    />
  );
}
