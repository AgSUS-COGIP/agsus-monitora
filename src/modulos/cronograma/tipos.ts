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
};
export type FiltrosDoCalendario = Readonly<{
  unidade: string;
  edital: string;
  tipo: string;
  busca: string;
}>;
export type CelulaDoCalendario = {
  chave: string;
  dia: number;
  rotulo: string;
  doMes: boolean;
  hoje: boolean;
  total: number;
  pontos: { tipo: TipoDaEtapa; total: number }[];
};
export type MarcoDaEtapa = "" | "início" | "fim";
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
}>;
type RespostaDaRpc = PromiseLike<{ data: unknown; error: unknown }>;
export type ClienteDoCalendario = {
  rpc: {
    (
      nome: "get_nucleo_cronograma_resumo" | "listar_etapas_do_cronograma",
    ): RespostaDaRpc;
    (
      nome: "get_monitoramento_cronograma",
      argumentos: { p_monitoramento_id: string | number },
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
};
export type OpcoesDaTelaDoCalendario = Pick<
  OpcoesDoEstadoDoCalendario,
  "supabase" | "toast"
> & {
  secao?: HTMLElement | null;
  agora?: () => Date;
};
