import type { DemandaInterna } from "../../lib/demandas-internas.ts";

export type TipoDaEtapa = { id: string; rotulo: string; cor: string };
export type EditalDoCalendario = {
  id: string;
  unidade: string;
  edital: string;
};
/** O banco pode devolver UUID ou identificador numérico. */
export type EditalComCronograma = Omit<EditalDoCalendario, "id"> & {
  id: string | number;
  cronograma_total: number;
};
export type EtapaDoCalendario = {
  editalId: string;
  unidade: string;
  edital: string;
  atividade: string;
  data_inicio: string;
  data_fim: string;
  ordem: number;
  tipo: TipoDaEtapa;
  busca: string;
  /** Só nas demandas internas vistas como etapa (src/lib/demandas-internas.ts). */
  demandaId?: string;
  /** Demanda interna marcada como concluída. */
  concluida?: boolean;
};
export type FiltrosDoCalendario = Readonly<{
  unidade: string;
  edital: string;
  busca: string;
}>;
export type CelulaDoCalendario = {
  chave: string;
  dia: number;
  rotulo: string;
  doMes: boolean;
  hoje: boolean;
  total: number;
  /** Os chips do dia: etapas que começam, terminam ou são só deste dia. */
  marcos: {
    etapa: EtapaDoCalendario;
    marca: "começa" | "último dia" | "no dia";
  }[];
  pontos: { tipo: TipoDaEtapa; total: number }[];
};
export type EditalComDataARevisar = {
  edital: string;
  etapasComProblema: number;
};
export type SnapshotDoCalendario = Readonly<{
  etapas: readonly EtapaDoCalendario[];
  editais: readonly EditalDoCalendario[];
  carregando: boolean;
  carregado: boolean;
  carregadoEm: string;
  erro: string;
  /** Demandas internas que a pessoa vê (todas as áreas; a tela recorta). */
  demandas: readonly DemandaInterna[];
  /** Áreas onde a pessoa pode criar demanda. */
  podeCriarEm: readonly string[];
}>;
type RespostaDaRpc = PromiseLike<{ data: unknown; error: unknown }>;
export type ClienteDoCalendario = {
  rpc: {
    (
      nome:
        | "get_nucleo_cronograma_resumo"
        | "listar_etapas_do_cronograma"
        | "listar_demandas_internas",
    ): RespostaDaRpc;
    (
      nome: "get_monitoramento_cronograma",
      argumentos: { p_monitoramento_id: string | number },
    ): RespostaDaRpc;
    /* Demandas internas (20261104120000): as únicas escritas desta tela. */
    (
      nome: "salvar_demanda_interna",
      argumentos: { p_demanda: Record<string, unknown> },
    ): RespostaDaRpc;
    (
      nome: "concluir_demanda_interna",
      argumentos: { p_id: string; p_concluida: boolean },
    ): RespostaDaRpc;
    (
      nome: "excluir_demanda_interna",
      argumentos: { p_id: string },
    ): RespostaDaRpc;
    (
      nome: "listar_pessoas_da_area",
      argumentos: { p_area: string; p_edital: string | null },
    ): RespostaDaRpc;
  };
  auth: {
    getSession: () => PromiseLike<{
      data: { session: { access_token: string } | null };
      error: unknown;
    }>;
  };
};
export type OpcoesDoEstadoDoCalendario = {
  supabase?: ClienteDoCalendario | null;
  toast?: (mensagem: string, tom?: "warn") => void;
  relogio?: () => number;
};
export type EstadoDoCalendario = {
  obter: () => SnapshotDoCalendario;
  assinar: (ouvinte: () => void) => () => void;
  carregar: (forcar?: boolean) => Promise<void>;
  invalidar: () => void;
  /** Uma demanda salva ou concluída: troca na lista sem recarregar tudo. */
  guardarDemanda: (demanda: DemandaInterna) => void;
  /** Uma demanda excluída sai da lista. */
  tirarDemanda: (id: string) => void;
};
export type OpcoesDaTelaDoCalendario = Pick<
  OpcoesDoEstadoDoCalendario,
  "supabase" | "toast"
> & {
  agora?: () => Date;
};
