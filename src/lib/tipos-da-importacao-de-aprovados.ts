/** Os seis campos aceitos pela RPC de importação, já validados. */
export interface CandidatoDaPlanilhaDeAprovados extends Record<
  string,
  unknown
> {
  codigo_vaga: string;
  cargo: string;
  classificacao: number;
  nota: number;
  nome: string;
  modalidade: string;
}
export interface ArquivoDaPlanilhaDeAprovados {
  name: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}
export interface MetadadosDoPdfDoCandidato {
  name: string;
  size: number;
  type?: string;
}
export interface ArquivoBinarioDoCandidato {
  arrayBuffer: () => Promise<ArrayBuffer>;
}
/** Formatos 1 (listas por ID) e 2 (listas e dicionários por índice). */
export interface PacoteDeCandidatosCompactos {
  formato?: number;
  area?: string;
  versao?: string;
  inalterado?: boolean;
  colunas: readonly string[];
  colunas_da_lista: readonly string[];
  linhas: readonly (readonly unknown[])[];
  listas:
    | readonly (readonly unknown[])[]
    | Readonly<Record<string, readonly unknown[]>>;
  dicionarios?: Readonly<Record<string, readonly unknown[]>>;
}
