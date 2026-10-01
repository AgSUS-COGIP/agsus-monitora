import { useEffect, useMemo, useState } from "react";
import { formatNumberBR } from "../lib/formatters.js";

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
  src/modules/mobile-table-cards.js, põe os rótulos); enquanto falta linha,
  "Carregar mais" faz o mesmo que rolar (teclado e leitor de tela).
*/

const POR_VEZ = 50;
const PERTO_DO_FIM_PX = 160;
const LINHAS_DO_ESQUELETO = 8;
const ARIA_SORT = { asc: "ascending", desc: "descending" };
const ICONE_DA_ORDEM = { asc: "fa-arrow-up", desc: "fa-arrow-down" };

function LinhasDoEsqueleto({ colunas }) {
  return Array.from({ length: LINHAS_DO_ESQUELETO }, (_, linha) => (
    <tr key={linha} aria-hidden="true">
      {Array.from({ length: colunas }, (__, coluna) => (
        <td key={coluna}>
          <span className="ui-esqueleto ui-esqueleto-linha" />
        </td>
      ))}
    </tr>
  ));
}

/**
 * @param {object} p
 * @param {string} p.idDoTitulo
 * @param {string} p.titulo
 * @param {{ placeholder: string, rotulo: string, valor?: string, aoMudar?: (busca: string) => void }} p.busca
 * @param {Array<{ rotulo: string, largura?: string, numero?: boolean, ordem?: string, aoOrdenar?: () => void }>} p.colunas
 *   com `aoOrdenar`, o cabeçalho vira botão de ordenar (`ordem`: "asc",
 *   "desc" ou "", liga o `aria-sort`)
 * @param {(quantos: number | null) => import("react").ReactNode} p.informacao
 *   a contagem do recorte: recebe quantos estão na tabela, ou `null`
 *   enquanto carrega
 * @param {import("react").ReactNode} p.vazio o que aparece quando não há nada carregado
 * @param {import("react").ReactNode} [p.ferramentas] botões ao lado da busca
 */
export function TabelaInfinita({
  idDoTitulo,
  titulo,
  busca: { placeholder, rotulo, valor, aoMudar },
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
}) {
  const [buscaPropria, setBuscaPropria] = useState("");
  const controlada = valor !== undefined;
  const busca = controlada ? valor : buscaPropria;
  const setBusca = (nova) => {
    if (!controlada) setBuscaPropria(nova);
    aoMudar?.(nova);
  };
  const [limite, setLimite] = useState(POR_VEZ);
  const naTabela = useMemo(
    () => filtrarPelaBusca(itens, busca),
    [itens, busca, filtrarPelaBusca],
  );
  useEffect(() => setLimite(POR_VEZ), [naTabela]);
  const visiveis = naTabela.slice(0, limite);
  const faltam = naTabela.length - visiveis.length;

  // O modo cartão do celular relê os cabeçalhos a cada desenho.
  const desenhadas = carregado ? visiveis.length : -1;
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [desenhadas, naTabela]);

  function aoRolar(evento) {
    const caixa = evento.currentTarget;
    if (
      faltam > 0 &&
      caixa.scrollTop + caixa.clientHeight >=
        caixa.scrollHeight - PERTO_DO_FIM_PX
    )
      setLimite((atual) => atual + POR_VEZ);
  }

  return (
    <section className="ui-card ui-tabela" aria-labelledby={idDoTitulo}>
      <div className="ui-tabela-topo">
        <div>
          <h2 className="ui-titulo" id={idDoTitulo}>
            {titulo}
          </h2>
        </div>
        <div className="ui-tabela-ferramentas">
          <input
            type="search"
            className="ui-tabela-busca"
            value={busca}
            disabled={!carregado}
            placeholder={placeholder}
            aria-label={rotulo}
            onChange={(evento) => setBusca(evento.target.value)}
          />
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
                ({ rotulo: nome, largura, numero, ordem, aoOrdenar }) => (
                  <th
                    key={nome}
                    scope="col"
                    style={{ width: largura }}
                    className={numero ? "num" : undefined}
                    aria-sort={
                      aoOrdenar ? ARIA_SORT[ordem] || "none" : undefined
                    }
                  >
                    {aoOrdenar ? (
                      <button
                        type="button"
                        className="ui-ordenar"
                        title={`Ordenar por ${nome}`}
                        onClick={aoOrdenar}
                      >
                        {nome}
                        <i
                          className={`fa-solid ${ICONE_DA_ORDEM[ordem] || "fa-sort"}`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      nome
                    )}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {!carregado ? (
              <LinhasDoEsqueleto colunas={colunas.length} />
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
          onClick={() => setLimite((atual) => atual + POR_VEZ)}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Carregar mais{" "}
          {formatNumberBR(Math.min(POR_VEZ, faltam))}
        </button>
      ) : null}
    </section>
  );
}
