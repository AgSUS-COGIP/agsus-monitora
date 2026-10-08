/** Contratos da navegação lateral e do catálogo usado pelo app. */
export interface ManutencaoDoMenu {
  readonly mensagem: string;
  readonly previsao: string | null;
}
export interface AreaDoCatalogo {
  readonly area: string;
  readonly ordem?: number | null;
  readonly view?: string | null;
  readonly icone?: string | null;
  readonly manutencao?: ManutencaoDoMenu | null;
}
export interface AbaDoCatalogo {
  readonly id: string;
  readonly rotulo: string;
  readonly icone: string;
  readonly ordem: number;
  readonly view: string;
  readonly recurso: string;
  readonly tipo: string;
  readonly beta?: boolean;
  readonly manutencao?: ManutencaoDoMenu | null;
  readonly areas: readonly AreaDoCatalogo[];
}
export interface ItemDoMenu {
  readonly view: string;
  readonly rotulo: string;
  readonly icone: string;
  readonly area?: string;
  readonly secao?: string;
  readonly beta?: boolean;
  readonly manutencao?: ManutencaoDoMenu | null;
}
export interface GrupoDoMenu {
  readonly id: string;
  readonly rotulo: string;
  readonly icone: string;
  readonly manutencao?: ManutencaoDoMenu | null;
  readonly itens: readonly ItemDoMenu[];
}
export type ArvoreDoMenu = readonly GrupoDoMenu[];
export interface ItemAtivoDoMenu {
  readonly view: string | null;
  readonly secao: string | null;
}
export interface OpcoesDaBarraLateral {
  navegar?(view: string): unknown;
  paginaAtiva?(view: string): boolean;
  aoAbrirSecao?(view: string, secao: string): unknown;
  textoVazio?: string;
}
export interface SnapshotDaBarraLateral {
  readonly arvore: ArvoreDoMenu;
  readonly ativo: ItemAtivoDoMenu;
  readonly opcoes: OpcoesDaBarraLateral;
}
export interface EstadoFlutuante {
  readonly aberta: string | null;
  readonly origem: "ponteiro" | "foco" | "clique" | null;
  readonly suprimida: string | null;
}
export type EventoFlutuante =
  | { tipo: "fechar" }
  | {
      tipo:
        | "apontar"
        | "focar"
        | "alternar"
        | "desapontar"
        | "desfocar"
        | "dispensar";
      area: string;
    };
export interface OpcoesDoMenu {
  permitidas?: Readonly<Record<string, boolean>>;
  paineis?: readonly { codigo?: string | null; titulo?: string | null }[];
  secoesDeConfiguracao?: readonly {
    id: string;
    rotulo: string;
    iconeDoMenu?: string;
  }[];
  areas?: unknown;
  abas?: readonly AbaDoCatalogo[] | null;
  situacao?: {
    readonly areas?: readonly {
      id: string;
      ativo: boolean;
      manutencao?: ManutencaoDoMenu | null;
    }[];
  } | null;
}
export interface PosicaoDoFlutuante {
  topoDoGatilho: number;
  alturaDoGatilho: number;
  alturaDoPainel: number;
  alturaDaJanela: number;
  alturaDaPilula?: number;
  margem?: number;
}
/** O que a prévia de Configurações › Marca passa à barra (rascunho, não o legado). */
export interface PreviaDaBarraLateral {
  readonly logo: string;
  readonly escuro: boolean;
  readonly versao: { readonly rotulo: string; readonly valor: string };
}
