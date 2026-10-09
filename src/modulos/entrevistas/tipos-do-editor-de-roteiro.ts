import type {
  DadosDoRoteiroParaSalvar,
  ModoDoEditorDeRoteiro,
  RoteiroDeEntrevista,
} from "../../lib/tipos-do-roteiro-de-entrevista.ts";
import type { ResultadoDoRenomear } from "../../ui/nome-da-versao.tsx";
import type {
  DadosDoEdital,
  EstadoDaConducaoComAcoes,
  Resultado,
} from "./tipos.ts";

export type PedidoDeRoteiro = { roteiro: RoteiroDeEntrevista; vez: number };
export type PropriedadesDaVisaoDeRoteiros = {
  conducao: EstadoDaConducaoComAcoes;
  area: string;
  pedido?: PedidoDeRoteiro | null;
  embutido?: boolean;
};
export type RoteiroAberto = {
  roteiro: RoteiroDeEntrevista | null;
  modo: ModoDoEditorDeRoteiro;
};
export type PropriedadesDoCartaoDoRoteiro = {
  roteiro: RoteiroDeEntrevista;
  podeEditar: boolean | null;
  aoAbrir: (roteiro: RoteiroDeEntrevista, modo: ModoDoEditorDeRoteiro) => void;
  aoRenomear?: (
    id: string,
    nome: string | null,
    motivo: string,
  ) => Promise<ResultadoDoRenomear>;
};
export type PropriedadesDoEditorDeRoteiro = {
  roteiro: RoteiroDeEntrevista | null;
  modo: ModoDoEditorDeRoteiro;
  area: string;
  regraDaClassificacao?: DadosDoEdital["regra_classificacao"];
  edital?: DadosDoEdital["edital"];
  somenteLeitura?: boolean;
  salvando?: boolean;
  aoSalvar: (dados: DadosDoRoteiroParaSalvar) => Promise<Resultado | void>;
  aoFechar: () => void;
};
