import { useEffect, useMemo, useRef, useState } from "react";
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
  (`TabelaDaLista`), com o cabeçalho fixo e a rolagem de 50 em 50: a tabela
  mostra 50 e, quando a rolagem chega perto do fim (um sentinela no fim da
  caixa que rola, observado com IntersectionObserver), mostra mais 50. O
  rodapé diz "Mostrando N de M" e tem o Exportar CSV. São dois componentes
  para a tela memorizar a tabela sem a barra (que muda a cada tecla).

  `itens` já vem filtrado e na ordem da tela. Com `servidor`
  (usarListaNoServidor), as linhas vêm do banco 50 por vez: chegar ao fim
  pede a página seguinte, e M é o total do recorte no banco.
  `chaveDoRecorte` volta às primeiras 50 quando muda (filtro, busca, ordem);
  sem ela, vale a lista (`itens`). Uma releitura com a mesma chave mantém o
  que já estava à vista.

  `grupo` desenha o cabeçalho de cada grupo; o recolhido aparece só pelo
  cabeçalho e não conta nas 50.

  No celular, a tabela rola de lado (`data-mobile-table="scroll"`: não vira
  cartões). Vazia: "Ninguém por aqui" e a linha de `vazio`.
*/

export const POR_VEZ_NA_LISTA = 50;
/* Quanto antes do fim a próxima leva começa (px). */
const ANTES_DO_FIM = "160px";

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

export interface PropriedadesDaTabelaDaLista<T> {
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
  As linhas à vista com os cabeçalhos dos grupos: o aberto mostra o
  cabeçalho onde o grupo começa; o recolhido, só o cabeçalho, na posição
  dele entre as linhas abertas já à vista.
*/
function linhasAgrupadas<T>({
  naTabela,
  limite,
  todas,
  grupo,
  linha,
  colunas,
}: {
  naTabela: readonly T[];
  limite: number;
  todas: boolean;
  grupo: GrupoDaTabela<T>;
  linha: (item: T) => ReactNode;
  colunas: number;
}) {
  const quantos = new Map<string, number>();
  for (const item of naTabela) {
    const chave = grupo.chave(item);
    quantos.set(chave, (quantos.get(chave) ?? 0) + 1);
  }
  const saida: ReactNode[] = [];
  let mostradas = 0;
  let atual: string | null = null;
  for (const item of naTabela) {
    const chave = grupo.chave(item);
    const recolhido = Boolean(grupo.recolhidos?.has(chave));
    if (mostradas >= limite && !(todas && recolhido)) break;
    if (chave !== atual)
      saida.push(
        <tr
          key={`grupo:${chave}`}
          className="ui-tabela-grupo"
          data-grupo={chave}
        >
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
        </tr>,
      );
    atual = chave;
    if (recolhido) continue;
    saida.push(linha(item));
    mostradas += 1;
  }
  return saida;
}

export function TabelaDaLista<T>({
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
}: PropriedadesDaTabelaDaLista<T>) {
  const recolhidos = grupo?.recolhidos;
  const abertos = useMemo(
    () =>
      grupo && recolhidos?.size
        ? itens.filter((item) => !recolhidos.has(grupo.chave(item)))
        : itens,
    [itens, grupo, recolhidos],
  );
  /*
    Quantas linhas estão à vista, guardado junto do recorte a que se refere:
    recorte novo começa nas primeiras 50 já neste desenho. No banco, as que
    já vieram.
  */
  const recorte = chaveDoRecorte === undefined ? itens : chaveDoRecorte;
  const [carga, setCarga] = useState({ recorte, limite: POR_VEZ_NA_LISTA });
  const limite = servidor
    ? abertos.length
    : carga.recorte === recorte
      ? carga.limite
      : POR_VEZ_NA_LISTA;
  const total = servidor ? servidor.total : abertos.length;
  const visiveis = Math.min(limite, abertos.length);
  const faltam = servidor
    ? servidor.temMais
      ? Math.max(1, servidor.total - abertos.length)
      : 0
    : abertos.length - visiveis;

  // A próxima leva (lida pelo observador, que não é recriado a cada desenho).
  const mais = useRef<() => void>(() => {});
  mais.current = () => {
    if (faltam <= 0) return;
    if (servidor) {
      if (!servidor.carregando) servidor.carregarMais();
      return;
    }
    setCarga({ recorte, limite: visiveis + POR_VEZ_NA_LISTA });
  };

  const caixa = useRef<HTMLDivElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const carregando = Boolean(servidor?.carregando);
  useEffect(() => {
    const raiz = caixa.current;
    const alvo = fim.current;
    if (!carregado || faltam <= 0 || carregando || !raiz || !alvo)
      return undefined;
    if (typeof IntersectionObserver !== "function") return undefined;
    /*
      Recriado a cada leva: se o fim continua à vista (poucas linhas na
      caixa), o primeiro aviso do observador novo já pede a próxima.
    */
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) mais.current();
      },
      { root: raiz, rootMargin: `0px 0px ${ANTES_DO_FIM} 0px` },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [carregado, faltam, visiveis, carregando]);

  const corpo = !carregado ? (
    <LinhasEsqueleto colunas={colunas.length} />
  ) : grupo && itens.length ? (
    linhasAgrupadas({
      naTabela: itens,
      limite: visiveis,
      todas: faltam <= 0,
      grupo,
      linha,
      colunas: colunas.length,
    })
  ) : (
    abertos.slice(0, visiveis).map(linha)
  );

  return (
    <>
      <div className="ui-tabela-rolagem ui-lista-rolagem" ref={caixa}>
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
        {carregado && !itens.length ? (
          <div className="ui-lista-vazia" role="status">
            <strong>Ninguém por aqui</strong>
            {vazio ? <span>{vazio}</span> : null}
          </div>
        ) : null}
        <div ref={fim} className="ui-lista-fim" aria-hidden="true" />
      </div>
      <div className="ui-lista-rodape">
        <span className="ui-lista-contagem" aria-live="polite">
          {!carregado
            ? "Carregando…"
            : carregando
              ? `Carregando mais… ${formatNumberBR(visiveis)} de ${formatNumberBR(total)}`
              : `Mostrando ${formatNumberBR(visiveis)} de ${formatNumberBR(total)}`}
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
      </div>
    </>
  );
}
