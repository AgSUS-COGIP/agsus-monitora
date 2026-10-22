/** Campos usados pelo recorte por área e pela Busca global. Os demais são dinâmicos. */
export interface LinhaDoMonitoramento {
  readonly [campo: string]: unknown;
  readonly id?: string | number;
  readonly CO_AREA?: string;
  readonly edital?: string;
  readonly unidade?: string;
  readonly etapa?: string;
  readonly status?: string;
  readonly uf?: string;
  readonly risco?: string;
  readonly ciclo?: string;
  readonly responsavel?: string;
  readonly observacoes?: string;
}
export interface UnidadeDoCatalogo {
  readonly [campo: string]: unknown;
}
export interface SnapshotDoMonitoramento {
  readonly linhas: readonly LinhaDoMonitoramento[];
  readonly unidades: readonly UnidadeDoCatalogo[];
  readonly carregado: boolean;
  readonly areas: readonly string[];
  readonly areaAtual: string;
}
export interface AreaAtualDoMonitoramento {
  readonly area: string;
  readonly nome: string;
  readonly linhas: readonly LinhaDoMonitoramento[];
  readonly ids: ReadonlySet<string>;
  readonly carregado: boolean;
}
