import { useEffect, useMemo, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  FILTROS_VAZIOS,
  filtrarVagas,
  formatarQuantidade,
  rotuloDaUnidade,
} from "../../lib/selecao-do-painel.js";

/*
  "Base operacional consolidada": a tabela do painel antigo (DSEI, edital,
  cargo, vaga, inscritos, aptos, triados, aprovados, contratados e
  observação), com a marcação da fila do painel de análises e o carregamento
  contínuo dele — 50 linhas por vez, e mais 50 quando a rolagem chega perto
  do fim. A busca do cabeçalho vale só para a tabela.
*/

const POR_VEZ = 50;
const PERTO_DO_FIM_PX = 160;
const LINHAS_DO_ESQUELETO = 8;

export const MENSAGEM_SEM_VAGAS =
  "Nenhuma vaga carregada para esta área ainda.";

const colunas = (area) => [
  [rotuloDaUnidade(area) === "Nome DSEI" ? "DSEI" : "Unidade", "15%", false],
  ["Edital", "9%", false],
  ["Cargo", "20%", false],
  ["Vaga", "7%", false],
  ["Inscritos", "7%", true],
  ["Aptos", "7%", true],
  ["Triados", "7%", true],
  ["Aprovados", "7%", true],
  ["Contratados", "7%", true],
  ["Observação", "14%", false],
];

function LinhasDoEsqueleto({ quantas }) {
  return Array.from({ length: LINHAS_DO_ESQUELETO }, (_, linha) => (
    <tr key={linha} aria-hidden="true">
      {Array.from({ length: quantas }, (__, coluna) => (
        <td key={coluna}>
          <span>&nbsp;</span>
        </td>
      ))}
    </tr>
  ));
}

export function TabelaDeVagas({ vagas, total, carregado, area }) {
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(POR_VEZ);
  const naTabela = useMemo(
    () => filtrarVagas(vagas, FILTROS_VAZIOS, busca),
    [vagas, busca],
  );
  useEffect(() => setLimite(POR_VEZ), [naTabela]);
  const visiveis = naTabela.slice(0, limite);
  const faltam = naTabela.length - visiveis.length;
  const cols = colunas(area);
  const n = formatarQuantidade;
  const daUnidade = rotuloDaUnidade(area) === "Nome DSEI" ? "DSEI" : "unidade";

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
    <section className="panel table-card" aria-labelledby="selecaoTabelaTitulo">
      <div className="table-head">
        <div>
          <h2 className="title" id="selecaoTabelaTitulo">
            Base operacional consolidada
          </h2>
        </div>
        <div className="table-tools">
          <input
            type="search"
            id="tableSearch"
            value={busca}
            disabled={!carregado}
            placeholder={`Buscar ${daUnidade}, edital, cargo ou observação`}
            aria-label="Buscar somente na tabela"
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>
      </div>
      <div className="table-meta">
        <span id="tableInfo">
          {carregado
            ? `Mostrando ${formatNumberBR(visiveis.length)} de ${formatNumberBR(naTabela.length)} registros`
            : "Mostrando 0 de 0 registros"}
        </span>
        <span id="pageInfo">
          {carregado
            ? naTabela.length === total
              ? `${formatNumberBR(total)} ${total === 1 ? "vaga" : "vagas"}`
              : `${formatNumberBR(naTabela.length)} de ${formatNumberBR(total)}`
            : "Carregando…"}
        </span>
      </div>
      <div className="table-wrap" onScroll={aoRolar}>
        <table className="selecao-tabela">
          <thead>
            <tr>
              {cols.map(([rotulo, largura, numero]) => (
                <th
                  key={rotulo}
                  scope="col"
                  style={{ width: largura }}
                  className={numero ? "num" : undefined}
                >
                  {rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody id="tableBody">
            {!carregado ? (
              <LinhasDoEsqueleto quantas={cols.length} />
            ) : visiveis.length ? (
              visiveis.map((v) => (
                <tr key={v.id} className="selecao-linha">
                  <td>
                    <div className="primary-text">{v.unidade || "—"}</div>
                  </td>
                  <td>{v.edital}</td>
                  <td>
                    <div className="primary-text">{v.cargo || "—"}</div>
                  </td>
                  <td>{v.vaga || "—"}</td>
                  <td className="num">{n(v.inscritos)}</td>
                  <td className="num">{n(v.aptos)}</td>
                  <td className="num">{n(v.triados)}</td>
                  <td className="num">{n(v.aprovados)}</td>
                  <td className="num">{n(v.contratados)}</td>
                  <td>
                    {v.observacao ? (
                      <span className="secondary-text">{v.observacao}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={cols.length} className="empty">
                  {total ? "Nenhum registro encontrado." : MENSAGEM_SEM_VAGAS}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {carregado && naTabela.length ? (
        <div
          className="analises-infinite-status"
          role="status"
          aria-live="polite"
        >
          {faltam > 0
            ? `${formatNumberBR(visiveis.length)} de ${formatNumberBR(naTabela.length)} registros`
            : `Todos os ${formatNumberBR(naTabela.length)} registros do recorte foram carregados`}
        </div>
      ) : null}
    </section>
  );
}
