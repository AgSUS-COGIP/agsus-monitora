/** Contratos da fronteira entre as regras dos mapas e a reconciliação em JavaScript. */
export interface UnidadeDaReconciliacao {
  nome: string;
  cnes?: string | number | null;
  chave?: string | number;
  lat: number | string | null;
  lon: number | string | null;
  municipio?: string;
  uf?: string | number;
  cod?: string | number | null;
  tipo?: string;
}

export interface UnidadeReconciliada {
  nome_exibicao: string;
  cnes: string | number;
  lat: number | string | null;
  lon: number | string | null;
  municipio: string;
  uf: string | number;
  origens: string[];
  nomes: { lmap: string; rede_cnes: string };
}

export interface ResultadoDaReconciliacao {
  reconciliados: UnidadeReconciliada[];
  ambiguos: unknown[];
  rejeitados: unknown[];
  polosSemPar: unknown[];
  estabelecimentosUsados: Set<string | number>;
}
