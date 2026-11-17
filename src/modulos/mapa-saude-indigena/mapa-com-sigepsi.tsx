import { useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PropsDoMapaSaudeIndigena } from "../../lib/mapa-saude-indigena/tipos.ts";
import { aplicarLocalizacoes } from "../../lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts";
import { ErroAoCarregar } from "../../ui/index.ts";
import { usarLocalizacoesDoSigepsi } from "./localizacoes.ts";
import { MapaSaudeIndigena } from "./mapa-saude-indigena.tsx";

/*
  O mapa da Saúde Indígena com os dados do SIGEPSI: a lista de DSEIs, as
  sedes, os pontos e as CASAIs são só os do SIGEPSI; do `lmap` do banco vêm só
  nome, população e UFs de cada DSEI. Sem plano B: enquanto o SIGEPSI não
  responde, o mapa espera; se ele falhar, mostra o erro e "Tentar novamente"
  (um dado desatualizado seria pior).

  Mora no pedaço do mapa (baixado sob demanda por
  src/modulos/visao-geral/mapas-sob-demanda.tsx), não na entrada: a Visão
  geral só passa o `lmap` do banco (17/11/2026, a entrada passava do
  orçamento de 320 KB gzip).
*/
export type PropsDoMapaComSigepsi = Omit<
  PropsDoMapaSaudeIndigena,
  "casaisNacionais" | "carregando"
> & { supabase?: SupabaseClient | null };

export function MapaSaudeIndigenaComSigepsi({
  lmap: lmapDoBanco,
  supabase = null,
  ...resto
}: PropsDoMapaComSigepsi) {
  const localizacoes = usarLocalizacoesDoSigepsi(supabase);
  const dados = localizacoes.dados;
  const lmap = useMemo(
    () => (dados ? aplicarLocalizacoes(lmapDoBanco, dados.dseis) : null),
    [lmapDoBanco, dados],
  );
  if (localizacoes.estado === "indisponivel")
    return (
      <ErroAoCarregar
        oQue="o mapa da Saúde Indígena: o SIGEPSI não respondeu"
        aoTentar={localizacoes.tentarDeNovo}
      />
    );
  return (
    <MapaSaudeIndigena
      {...resto}
      lmap={lmap}
      casaisNacionais={dados?.casaisNacionais ?? []}
      carregando={!lmap}
    />
  );
}
