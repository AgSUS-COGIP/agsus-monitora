import { useEffect, useMemo, useState } from "react";
import type { AriaAttributes, KeyboardEvent, ReactNode, UIEvent } from "react";
import { formatNumberBR } from "../lib/formatters";
import { classes } from "./classes.ts";
import { LinhasEsqueleto } from "./esqueleto.tsx";

/*
  A tabela das telas, com carregamento contínuo: 50 linhas por vez, e mais 50
  quando a rolagem chega perto do fim (a faixa de status diz quanto falta). A
  busca do cabeçalho vale só para a tabela.

  `itens` já vem recortado pelos filtros da tela; `filtrarPelaBusca(itens,
  busca)` aplica a busca da tabela (que a tela pode controlar: `busca.valor` e
  `busca.aoMudar`, para limpá-la junto com os filtros ou reagir a ela) — passe uma função estável (de módulo), ela
  entra na memória do recorte. `linha(item)` devolve o `<tr>` com `key`.

  Marcação: `.ui-card.ui-tabela` (topo, meta, rolagem, status); depois de
  desenhar, avisa `agsus:content-updated` (o modo cartão do celular,
  src/app/casca/tabelas-em-cartoes.ts, põe os rótulos); enquanto falta linha,
  "Carregar mais" faz o mesmo que rolar (teclado e leitor de tela).
*/

const POR_VEZ = 50;

/**
 * O campo de busca da tabela. `aoTeclar`: o onKeyDown do campo (ex.: Enter
 * abre o achado); `tour`: o `data-tour` do campo.
 */
export interface BuscaDaTabela {
  placeholder: string;
  rotulo: string;
  valor?: string;
  aoMudar?: (busca: string) => void;
  aoTeclar?: (evento: KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
  tour?: string;
}

/**
 * Uma coluna. Com `aoOrdenar`, o cabeçalho vira botão de ordenar (`ordem`:
 * "asc", "desc" ou "", liga o `aria-sort`); `cabecalho` troca o texto do th
 * (ex.: a caixa "selecionar todos"), `dica` é o title do cabeçalho (sigla
 * explicada) e `chave` vale quando o rótulo se repete.
 */
export interface ColunaDaTabela {
  rotulo: string;
  chave?: string;
  cabecalho?: ReactNode;
  dica?: string;
  largura?: string;
  numero?: boolean;
  ordem?: string;
  aoOrdenar?: () => void;
}

/**
 * Agrupa as linhas: um cabeçalho de grupo (`tr.ui-tabela-grupo`) sempre que
 * `chave(item)` muda (os itens já vêm na ordem dos grupos); o grupo em
 * `recolhidos` mostra só o cabeçalho, e clicar nele chama `aoAlternar`.
 */
export interface GrupoDaTabela<T> {
  chave: (item: T) => string;
  cabecalho: (chave: string, quantos: number) => ReactNode;
  recolhidos?: Set<string>;
  aoAlternar?: (chave: string) => void;
}

/**
 * `busca` é opcional: sem ela, a tabela não desenha o campo (a tela o põe
 * junto dos filtros) e `filtrarPelaBusca` recebe "".
 */
export interface PropriedadesDaTabelaInfinita<T> {
  idDoTitulo: string;
  titulo: string;
  busca?: BuscaDaTabela | null;
  colunas: ReadonlyArray<ColunaDaTabela>;
  /**
   * A contagem do recorte: recebe quantos estão na tabela, ou `null`
   * enquanto carrega.
   */
  informacao: (quantos: number | null) => ReactNode;
  /** O que aparece quando não há nada carregado. */
  vazio: ReactNode;
  /** Botões ao lado da busca. */
  ferramentas?: ReactNode;
  /** Classe a mais no card (seletor de tour). */
  className?: string;
  /** Id do `<tbody>` (contrato com o legado e a Aya). */
  idDoCorpo?: string;
  carregado: boolean;
  itens: readonly T[];
  filtrarPelaBusca: (itens: readonly T[], busca: string) => readonly T[];
  linha: (item: T) => ReactNode;
  total: number;
  classeDaTabela?: string;
  tour?: string;
  grupo?: GrupoDaTabela<T> | null;
}

/*
  As linhas com o cabeçalho de cada grupo: o grupo recolhido aparece só pelo
  cabeçalho; o aberto, com as linhas já carregadas (`visiveis`).
*/
function linhasAgrupadas<T>({
  naTabela,
  visiveis,
  grupo,
  linha,
  colunas,
}: {
  naTabela: readonly T[];
  visiveis: readonly T[];
  grupo: GrupoDaTabela<T>;
  linha: (item: T) => ReactNode;
  colunas: number;
}) {
  const carregados = new Set(visiveis);
  const quantos = new Map<string, number>();
  for (const item of naTabela) {
    const chave = grupo.chave(item);
    quantos.set(chave, (quantos.get(chave) ?? 0) + 1);
  }
  const saida: ReactNode[] = [];
  let atual: string | null = null;
  for (const item of naTabela) {
    const chave = grupo.chave(item);
    const recolhido = Boolean(grupo.recolhidos?.has(chave));
    if (chave !== atual) {
      atual = chave;
      // Grupo aberto ainda não carregado: o cabeçalho espera as linhas.
      if (!recolhido && !carregados.has(item)) break;
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
    }
    if (!recolhido && carregados.has(item)) saida.push(linha(item));
  }
  return saida;
}
const PERTO_DO_FIM_PX = 160;
const ARIA_SORT: Partial<Record<string, AriaAttributes["aria-sort"]>> = {
  asc: "ascending",
  desc: "descending",
};
const ICONE_DA_ORDEM: Partial<Record<string, string>> = {
  asc: "fa-arrow-up",
  desc: "fa-arrow-down",
};

export function TabelaInfinita<T>({
  idDoTitulo,
  titulo,
  busca: campoDeBusca = null,
  carregado,
  itens,
  filtrarPelaBusca,
  colunas,
  classeDaTabela,
  linha,
  informacao,
  total,
  vazio,
  ferramentas = null,
  className,
  idDoCorpo,
  tour,
  grupo = null,
}: PropriedadesDaTabelaInfinita<T>) {
  const {
    placeholder,
    rotulo,
    valor,
    aoMudar,
    aoTeclar,
    id: idDaBusca,
    tour: tourDaBusca,
  }: Partial<BuscaDaTabela> = campoDeBusca || { valor: "" };
  const [buscaPropria, setBuscaPropria] = useState("");
  const controlada = valor !== undefined;
  const busca = controlada ? valor : buscaPropria;
  const setBusca = (nova: string) => {
    if (!controlada) setBuscaPropria(nova);
    aoMudar?.(nova);
  };
  const naTabela = useMemo(
    () => filtrarPelaBusca(itens, busca),
    [itens, busca, filtrarPelaBusca],
  );
  /*
    Quantas linhas estão carregadas, guardado junto do recorte a que se refere:
    recorte novo (filtro, busca, ordem) começa nas primeiras 50 já neste
    desenho. Zerar num efeito desenhava antes o recorte novo com o limite
    antigo — com milhares de linhas carregadas, ordenar ou filtrar levava
    segundos.
  */
  const [carga, setCarga] = useState({ recorte: naTabela, limite: POR_VEZ });
  const limite = carga.recorte === naTabela ? carga.limite : POR_VEZ;
  const carregarMais = () =>
    setCarga((atual) => ({
      recorte: naTabela,
      limite: (atual.recorte === naTabela ? atual.limite : POR_VEZ) + POR_VEZ,
    }));
  const recolhidos = grupo?.recolhidos;
  // Agrupada: os itens dos grupos recolhidos não contam para o carregamento contínuo.
  const abertos = useMemo(
    () =>
      grupo && recolhidos?.size
        ? naTabela.filter((item) => !recolhidos.has(grupo.chave(item)))
        : naTabela,
    [naTabela, grupo, recolhidos],
  );
  const visiveis = abertos.slice(0, limite);
  const faltam = abertos.length - visiveis.length;

  // O modo cartão do celular relê os cabeçalhos a cada desenho.
  const desenhadas = carregado ? visiveis.length : -1;
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [desenhadas, naTabela]);

  function aoRolar(evento: UIEvent<HTMLDivElement>) {
    const caixa = evento.currentTarget;
    if (
      faltam > 0 &&
      caixa.scrollTop + caixa.clientHeight >=
        caixa.scrollHeight - PERTO_DO_FIM_PX
    )
      carregarMais();
  }

  return (
    <section
      className={classes("ui-card ui-tabela", className)}
      aria-labelledby={idDoTitulo}
      data-tour={tour}
    >
      <div className="ui-tabela-topo">
        <div>
          <h2 className="ui-titulo" id={idDoTitulo}>
            {titulo}
          </h2>
        </div>
        <div className="ui-tabela-ferramentas">
          {campoDeBusca ? (
            <input
              id={idDaBusca}
              type="search"
              className="ui-tabela-busca"
              value={busca}
              disabled={!carregado}
              placeholder={placeholder}
              aria-label={rotulo}
              data-tour={tourDaBusca}
              onChange={(evento) => setBusca(evento.target.value)}
              onKeyDown={aoTeclar}
            />
          ) : null}
          {ferramentas}
        </div>
      </div>
      <div className="ui-tabela-meta">
        <span data-tabela-mostrando="">
          {carregado
            ? `Mostrando ${formatNumberBR(visiveis.length)} de ${formatNumberBR(naTabela.length)} registros`
            : "Mostrando 0 de 0 registros"}
        </span>
        <span data-tabela-contagem="">
          {informacao(carregado ? naTabela.length : null)}
        </span>
      </div>
      <div className="ui-tabela-rolagem" onScroll={aoRolar}>
        <table className={classeDaTabela}>
          <thead>
            <tr>
              {colunas.map(
                ({
                  rotulo: nome,
                  chave,
                  cabecalho,
                  largura,
                  numero,
                  ordem,
                  aoOrdenar,
                  dica,
                }) => (
                  <th
                    key={chave ?? nome}
                    scope="col"
                    title={dica}
                    style={{ width: largura }}
                    className={numero ? "num" : undefined}
                    aria-sort={
                      aoOrdenar ? ARIA_SORT[ordem ?? ""] || "none" : undefined
                    }
                  >
                    {aoOrdenar ? (
                      <button
                        type="button"
                        className="ui-ordenar"
                        title={
                          dica
                            ? `Ordenar por ${nome}. ${dica}`
                            : `Ordenar por ${nome}`
                        }
                        onClick={aoOrdenar}
                      >
                        {nome}
                        <i
                          className={`fa-solid ${ICONE_DA_ORDEM[ordem ?? ""] || "fa-sort"}`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      (cabecalho ?? nome)
                    )}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody id={idDoCorpo} aria-busy={carregado ? undefined : true}>
            {!carregado ? (
              <LinhasEsqueleto colunas={colunas.length} />
            ) : grupo && naTabela.length ? (
              linhasAgrupadas({
                naTabela,
                visiveis,
                grupo,
                linha,
                colunas: colunas.length,
              })
            ) : visiveis.length ? (
              visiveis.map(linha)
            ) : (
              <tr>
                <td colSpan={colunas.length} className="ui-vazio">
                  {total ? "Nenhum registro encontrado." : vazio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {carregado && naTabela.length ? (
        <div className="ui-tabela-status" role="status" aria-live="polite">
          {faltam > 0
            ? `${formatNumberBR(visiveis.length)} de ${formatNumberBR(naTabela.length)} registros`
            : `Todos os ${formatNumberBR(naTabela.length)} registros do recorte foram carregados`}
        </div>
      ) : null}
      {carregado && faltam > 0 ? (
        <button
          type="button"
          className="btn secondary small ui-tabela-mais"
          data-acao="carregar-mais"
          onClick={() => carregarMais()}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Carregar mais{" "}
          {formatNumberBR(Math.min(POR_VEZ, faltam))}
        </button>
      ) : null}
    </section>
  );
}
