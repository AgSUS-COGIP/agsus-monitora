import type { LinhaDoMonitoramento } from "../tipos-do-monitoramento.ts";

export type LinhaDaBusca = LinhaDoMonitoramento;
export type ResultadoDaBusca = LinhaDaBusca & { readonly id: string | number };
export interface OpcoesDaBusca {
  estaConectado(): boolean;
  aoEscolher(linha: ResultadoDaBusca): void;
}
export interface AtalhoDaBusca {
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly key?: string;
}
export interface ParteDoRealce {
  readonly texto: string;
  readonly realce: boolean;
}
