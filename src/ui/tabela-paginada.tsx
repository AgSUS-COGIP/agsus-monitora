import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { formatNumberBR } from "../lib/formatters";
import { classes } from "./classes.ts";
import { LinhasEsqueleto } from "./esqueleto.tsx";
import { CabecalhosDaTabela } from "./tabela-infinita.tsx";
import type {
  ColunaDaTabela,
  GrupoDaTabela,
  TabelaNoServidor,
} from "./tabela-infinita.tsx";

/*
  A lista das telas da seleção: o card (`CardDaLista`, `.ui-card.ui-lista`)
  junta a barra de busca e filtros, a barra da seleção em lote e a tabela
  (`TabelaPaginada`), com o cabeçalho fixo ao rolar e o rodapé "1–50 de N",
  Exportar CSV e Anterior / Próxima — 50 por vez. São dois componentes para a
  tela memorizar a tabela sem a barra (que muda a cada tecla).

  `itens` já vem filtrado e na ordem da tela. Com `servidor`
  (usarListaNoServidor), as linhas vêm do banco 50 por vez: "Próxima" pede a
  página seguinte quando ela ainda não chegou, e o total é o do recorte no
  banco. `chaveDoRecorte` volta à primeira página quando muda (filtro,
  busca, ordem); sem ela, a página só se ajusta ao tamanho da lista (uma
  releitura não manda a pessoa de volta ao começo).

  `grupo` desenha o cabeçalho de cada grupo na página (o grupo que continua
  da página anterior repete o cabeçalho); o recolhido aparece só pelo
  cabeçalho e não conta na paginação.

  No celular, a tabela rola de lado (`data-mobile-table="scroll"`: não vira
  cartões). Vazia: "Ninguém por aqui" e a linha de `vazio`.
*/

export const POR_PAGINA = 50;

export interface PropriedadesDoCardDaLista {
  /** O nome acessível da lista. */
  rotulo: string;
  className?: string;
  tour?: string;
  children?: ReactNode;
}

export function CardDaLista({
  rotulo,
  className,
  tour,
  children,
}: PropriedadesDoCardDaLista) {
  return (
    <section
      className={classes("ui-card ui-lista", className)}
      aria-label={rotulo}
      data-tour={tour}
    >
      {children}
    </section>
  );
}

export interface PropriedadesDaTabelaPaginada<T> {
  /** O nome acessível da tabela. */
  rotulo: string;
  colunas: ReadonlyArray<ColunaDaTabela>;
  itens: readonly T[];
  linha: (item: T) => ReactNode;
  carregado: boolean;
  /** A linha embaixo de "Ninguém por aqui". */
  vazio: ReactNode;
  grupo?: GrupoDaTabela<T> | null;
  servidor?: TabelaNoServidor | null;
  chaveDoRecorte?: unknown;
  aoExportar?: (() => void) | null;
  exportarDesativado?: boolean;
  /** O que mais vai no rodapé, antes de Exportar. */
  rodape?: ReactNode;
  classeDaTabela?: string;
  idDoCorpo?: string;
}

/*
  As linhas da página com os cabeçalhos dos grupos: o aberto mostra o
  cabeçalho onde a página começa ou o grupo muda; o recolhido, só o
  cabeçalho, na posição dele entre as linhas abertas da página.
*/
function linhasDaPagina<T>({
  naTabela,
  inicio,
  fim,
  ultima,
  grupo,
  linha,
  colunas,
}: {
  naTabela: readonly T[];
  inicio: number;
  fim: number;
  ultima: boolean;
  grupo: GrupoDaTabela<T>;
  linha: (item: T) => ReactNode;
  colunas: number;
}) {
  const quantos = new Map<string, number>();
  for (const item of naTabela) {
    const chave = grupo.chave(item);
    quantos.set(chave, (quantos.get(chave) ?? 0) + 1);
  }
  const cabecalho = (chave: string, recolhido: boolean) => (
    <tr key={`grupo:${chave}`} className="ui-tabela-grupo" data-grupo={chave}>
      <th scope="colgroup" colSpan={colunas}>
        <button
          type="button"
          aria-expanded={!recolhido}
          onClick={() => grupo.aoAlternar?.(chave)}
        >
          <i
            className={`fa-solid ${recolhido ? "fa-chevron-right" : "fa-chevron-down"}`}
            aria-hidden="true"
          />
          {grupo.cabecalho(chave, quantos.get(chave)!)}
        </button>
      </th>
    </tr>
  );
  const saida: ReactNode[] = [];
  let posicao = 0; // linhas abertas antes deste item
  let atual: string | null = null;
  for (const item of naTabela) {
    const chave = grupo.chave(item);
    const recolhido = Boolean(grupo.recolhidos?.has(chave));
    if (recolhido) {
      const naPagina =
        (posicao >= inicio && posicao < fim) || (ultima && posicao >= fim);
      if (chave !== atual && naPagina) saida.push(cabecalho(chave, true));
      atual = chave;
      continue;
    }
    if (posicao >= inicio && posicao < fim) {
      if (chave !== atual || posicao === inicio)
        saida.push(cabecalho(chave, false));
      saida.push(linha(item));
    }
    atual = chave;
    posicao += 1;
    if (posicao >= fim && !ultima) break;
  }
  return saida;
}

export function TabelaPaginada<T>({
  rotulo,
  colunas,
  itens,
  linha,
  carregado,
  vazio,
  grupo = null,
  servidor = null,
  chaveDoRecorte,
  aoExportar = null,
  exportarDesativado = false,
  rodape = null,
  classeDaTabela,
  idDoCorpo,
}: PropriedadesDaTabelaPaginada<T>) {
  const recolhidos = grupo?.recolhidos;
  const abertos = useMemo(
    () =>
      grupo && recolhidos?.size
        ? itens.filter((item) => !recolhidos.has(grupo.chave(item)))
        : itens,
    [itens, grupo, recolhidos],
  );
  const recorte = chaveDoRecorte === undefined ? itens : chaveDoRecorte;
  const [estado, setEstado] = useState({ recorte, pagina: 0 });
  const total = servidor ? servidor.total : abertos.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pedida = estado.recorte === recorte ? estado.pagina : 0;
  const pagina = Math.min(pedida, paginas - 1);
  const inicio = pagina * POR_PAGINA;
  const fim = Math.min(total, inicio + POR_PAGINA);
  // No banco, a página pedida pode ainda não ter chegado.
  const esperando =
    Boolean(servidor) && abertos.length < fim && Boolean(servidor?.temMais);
  const ir = (nova: number) => {
    if (servidor && (nova + 1) * POR_PAGINA > abertos.length)
      if (servidor.temMais && !servidor.carregando) servidor.carregarMais();
    setEstado({ recorte, pagina: nova });
  };
  const ultima = pagina >= paginas - 1;

  const corpo =
    !carregado || esperando ? (
      <LinhasEsqueleto colunas={colunas.length} />
    ) : grupo && itens.length ? (
      linhasDaPagina({
        naTabela: itens,
        inicio,
        fim,
        ultima,
        grupo,
        linha,
        colunas: colunas.length,
      })
    ) : total ? (
      abertos.slice(inicio, fim).map(linha)
    ) : null;

  return (
    <>
      <div className="ui-tabela-rolagem ui-lista-rolagem">
        <table
          className={classeDaTabela}
          aria-label={rotulo}
          data-mobile-table="scroll"
        >
          <CabecalhosDaTabela colunas={colunas} />
          <tbody id={idDoCorpo} aria-busy={carregado ? undefined : true}>
            {corpo}
          </tbody>
        </table>
        {carregado && !esperando && !total && !(grupo && itens.length) ? (
          <div className="ui-lista-vazia" role="status">
            <strong>Ninguém por aqui</strong>
            {vazio ? <span>{vazio}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="ui-lista-rodape">
        <span className="ui-lista-contagem" aria-live="polite">
          {!carregado
            ? "Carregando…"
            : total
              ? `${formatNumberBR(inicio + 1)}–${formatNumberBR(fim)} de ${formatNumberBR(total)}`
              : "0 de 0"}
        </span>
        {rodape}
        {aoExportar ? (
          <button
            type="button"
            className="btn ghost small ui-lista-exportar"
            data-acao="exportar-csv"
            disabled={exportarDesativado || !total}
            onClick={aoExportar}
          >
            <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
            CSV
          </button>
        ) : null}
        <span className="ui-lista-paginas">
          <button
            type="button"
            className="btn contorno small"
            data-acao="pagina-anterior"
            disabled={!carregado || pagina === 0}
            onClick={() => ir(pagina - 1)}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn contorno small"
            data-acao="pagina-proxima"
            disabled={!carregado || ultima || Boolean(servidor?.carregando)}
            onClick={() => ir(pagina + 1)}
          >
            Próxima
          </button>
        </span>
      </div>
    </>
  );
}
