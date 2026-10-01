import { useEffect, useMemo, useState } from "react";
import { formatNumberBR } from "../lib/formatters.js";
import { usarNoQuadro } from "./no-quadro.jsx";

/*
  A tabela das telas, com carregamento contínuo: 50 linhas por vez, e mais 50
  quando a rolagem chega perto do fim (a faixa de status diz quanto falta). A
  busca do cabeçalho vale só para a tabela.

  `itens` já vem recortado pelos filtros da tela; `filtrarPelaBusca(itens,
  busca)` aplica a busca da tabela (que a tela pode controlar: `busca.valor` e
  `busca.aoMudar`, para limpá-la junto com os filtros ou reagir a ela) — passe uma função estável (de módulo), ela
  entra na memória do recorte. `linha(item)` devolve o `<tr>` com `key`.

  Dentro do app: `.ui-card.ui-tabela` (topo, meta, rolagem, status); depois de
  desenhar, avisa `agsus:content-updated` (o modo cartão do celular,
  src/modules/mobile-table-cards.js, põe os rótulos); enquanto falta linha,
  "Carregar mais" faz o mesmo que rolar (teclado e leitor de tela). No quadro
  (<PainelNoQuadro>): a "Fila operacional consolidada" do painel de análises
  (`.table-card`, `tbody#tableBody`, `#tableSearch`, `#tableInfo`,
  `#pageInfo`, `.analises-infinite-status`).
*/

const POR_VEZ = 50;
const PERTO_DO_FIM_PX = 160;
const LINHAS_DO_ESQUELETO = 8;

function LinhasDoEsqueleto({ colunas, noQuadro }) {
  return Array.from({ length: LINHAS_DO_ESQUELETO }, (_, linha) => (
    <tr key={linha} aria-hidden="true">
      {Array.from({ length: colunas }, (__, coluna) => (
        <td key={coluna}>
          {noQuadro ? (
            <span>&nbsp;</span>
          ) : (
            <span className="ui-esqueleto ui-esqueleto-linha" />
          )}
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
 * @param {Array<{ rotulo: string, largura?: string, numero?: boolean }>} p.colunas
 * @param {(quantos: number | null) => import("react").ReactNode} p.informacao
 *   a contagem do recorte: recebe quantos estão na tabela, ou `null`
 *   enquanto carrega
 * @param {import("react").ReactNode} p.vazio o que aparece quando não há nada carregado
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
}) {
  const noQuadro = usarNoQuadro();
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

  // Dentro do app, o modo cartão do celular relê os cabeçalhos a cada desenho.
  const desenhadas = carregado ? visiveis.length : -1;
  useEffect(() => {
    if (noQuadro) return;
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [noQuadro, desenhadas, naTabela]);

  function aoRolar(evento) {
    const caixa = evento.currentTarget;
    if (
      faltam > 0 &&
      caixa.scrollTop + caixa.clientHeight >=
        caixa.scrollHeight - PERTO_DO_FIM_PX
    )
      setLimite((atual) => atual + POR_VEZ);
  }

  const c = (antiga, nova) => (noQuadro ? antiga : nova);
  const id = (valor) => (noQuadro ? valor : undefined);

  return (
    <section
      className={c("panel table-card", "ui-card ui-tabela")}
      aria-labelledby={idDoTitulo}
    >
      <div className={c("table-head", "ui-tabela-topo")}>
        <div>
          <h2 className={c("title", "ui-titulo")} id={idDoTitulo}>
            {titulo}
          </h2>
        </div>
        <div className={c("table-tools", "ui-tabela-ferramentas")}>
          <input
            type="search"
            id={id("tableSearch")}
            className={c(undefined, "ui-tabela-busca")}
            value={busca}
            disabled={!carregado}
            placeholder={placeholder}
            aria-label={rotulo}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>
      </div>
      <div className={c("table-meta", "ui-tabela-meta")}>
        <span
          id={id("tableInfo")}
          data-tabela-mostrando={noQuadro ? undefined : ""}
        >
          {carregado
            ? `Mostrando ${formatNumberBR(visiveis.length)} de ${formatNumberBR(naTabela.length)} registros`
            : "Mostrando 0 de 0 registros"}
        </span>
        <span
          id={id("pageInfo")}
          data-tabela-contagem={noQuadro ? undefined : ""}
        >
          {informacao(carregado ? naTabela.length : null)}
        </span>
      </div>
      <div className={c("table-wrap", "ui-tabela-rolagem")} onScroll={aoRolar}>
        <table className={classeDaTabela}>
          <thead>
            <tr>
              {colunas.map(({ rotulo: nome, largura, numero }) => (
                <th
                  key={nome}
                  scope="col"
                  style={{ width: largura }}
                  className={numero ? "num" : undefined}
                >
                  {nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody id={id("tableBody")}>
            {!carregado ? (
              <LinhasDoEsqueleto colunas={colunas.length} noQuadro={noQuadro} />
            ) : visiveis.length ? (
              visiveis.map(linha)
            ) : (
              <tr>
                <td colSpan={colunas.length} className={c("empty", "ui-vazio")}>
                  {total ? "Nenhum registro encontrado." : vazio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {carregado && naTabela.length ? (
        <div
          className={c("analises-infinite-status", "ui-tabela-status")}
          role="status"
          aria-live="polite"
        >
          {faltam > 0
            ? `${formatNumberBR(visiveis.length)} de ${formatNumberBR(naTabela.length)} registros`
            : `Todos os ${formatNumberBR(naTabela.length)} registros do recorte foram carregados`}
        </div>
      ) : null}
      {!noQuadro && carregado && faltam > 0 ? (
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
