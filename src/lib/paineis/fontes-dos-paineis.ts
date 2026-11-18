/*
  FONTES DAS COLUNAS DOS PAINÉIS no front (migration 20261113220000): de onde
  vem cada coluna editável dos relatórios, escolhida por área entre as visões
  conferidas do schema `painel`.

  Aqui, sem DOM: a leitura tolerante do que as RPCs devolvem — `fontes` e
  `avisos` na resposta de cada relatório, e o editor de fontes
  (`listar_fontes_do_painel` / `salvar_fonte_da_coluna`). Nenhum SQL sai do
  front: a tela só manda o nome da visão e da coluna escolhidos entre as
  opções que o banco listou, e o banco confere de novo.
*/

/* As RPCs do editor (RPC_*: o nome que o contrato de RPC confere). */
export const RPC_LISTAR_FONTES_DO_PAINEL = "listar_fontes_do_painel";
export const RPC_SALVAR_FONTE_DA_COLUNA = "salvar_fonte_da_coluna";

/** A origem de uma coluna editável na resposta de um relatório. */
export interface FonteDaColuna {
  padrao: boolean;
  visao: string | null;
  coluna: string | null;
  /** "Padrão: …" ou "<fonte> › <coluna>". */
  rotulo: string;
}

export interface OpcaoDeFonte {
  visao: string;
  rotulo: string;
  colunas: readonly { coluna: string; rotulo: string }[];
}

export interface ColunaComFonte {
  coluna: string;
  rotulo: string;
  tipo: string;
  padrao: string;
  escolha: { visao: string; coluna: string } | null;
  opcoes: readonly OpcaoDeFonte[];
}

export interface TrocaDeFonte {
  em: string;
  nome: string;
  coluna: string;
  antes: string;
  depois: string;
  motivo: string;
}

export interface FontesDoPainel {
  podeEditar: boolean;
  colunas: readonly ColunaComFonte[];
  historico: readonly TrocaDeFonte[];
}

type Registro = Record<string, unknown>;
const registro = (valor: unknown): Registro | null =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : null;
const texto = (valor: unknown) =>
  typeof valor === "string" ? valor.trim() : "";
const lista = (valor: unknown): unknown[] =>
  Array.isArray(valor) ? valor : [];

/** `fontes` e `avisos` da resposta de um relatório (vazios se não vierem). */
export function lerFontesDoRelatorio(resposta: unknown): {
  fontes: Readonly<Record<string, FonteDaColuna>>;
  avisos: readonly string[];
} {
  const r = registro(resposta);
  const fontes: Record<string, FonteDaColuna> = {};
  for (const [campo, bruto] of Object.entries(registro(r?.fontes) ?? {})) {
    const f = registro(bruto);
    if (!f) continue;
    fontes[campo] = {
      padrao: f.padrao === true,
      visao: texto(f.visao) || null,
      coluna: texto(f.coluna) || null,
      rotulo: texto(f.rotulo),
    };
  }
  const avisos = lista(r?.avisos)
    .map(texto)
    .filter((aviso) => aviso !== "");
  return { fontes, avisos };
}

function lerOpcao(bruto: unknown): OpcaoDeFonte | null {
  const o = registro(bruto);
  const visao = texto(o?.visao);
  if (!o || !visao) return null;
  const colunas = lista(o.colunas)
    .map((c) => {
      const r = registro(c);
      return { coluna: texto(r?.coluna), rotulo: texto(r?.rotulo) };
    })
    .filter((c) => c.coluna !== "");
  return { visao, rotulo: texto(o.rotulo) || visao, colunas };
}

function lerColuna(bruto: unknown): ColunaComFonte | null {
  const c = registro(bruto);
  const coluna = texto(c?.coluna);
  const rotulo = texto(c?.rotulo);
  if (!c || !coluna || !rotulo) return null;
  const escolha = registro(c.escolha);
  return {
    coluna,
    rotulo,
    tipo: texto(c.tipo),
    padrao: texto(c.padrao),
    escolha:
      escolha && texto(escolha.visao) && texto(escolha.coluna)
        ? { visao: texto(escolha.visao), coluna: texto(escolha.coluna) }
        : null,
    opcoes: lista(c.opcoes)
      .map(lerOpcao)
      .filter((o): o is OpcaoDeFonte => o !== null),
  };
}

/** O editor de fontes de um relatório numa área, ou `null` se a resposta não for objeto. */
export function lerFontesDoPainel(resposta: unknown): FontesDoPainel | null {
  const r = registro(resposta);
  if (!r) return null;
  return {
    podeEditar: r.pode_editar === true,
    colunas: lista(r.colunas)
      .map(lerColuna)
      .filter((c): c is ColunaComFonte => c !== null),
    historico: lista(r.historico)
      .map((bruto) => {
        const h = registro(bruto);
        return {
          em: texto(h?.em),
          nome: texto(h?.nome),
          coluna: texto(h?.coluna),
          antes: texto(h?.antes),
          depois: texto(h?.depois),
          motivo: texto(h?.motivo),
        };
      })
      .filter((h) => h.em !== ""),
  };
}
