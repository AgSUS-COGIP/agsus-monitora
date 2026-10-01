import { useEffect, useMemo, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  badgeDoParecer,
  FILTROS_VAZIOS,
  filtrarEntrevistas,
  formatarNota,
  rotuloDoComparecimento,
  rotuloDoParecer,
} from "../../lib/entrevistas-do-painel.js";

/*
  "Entrevistas": a tabela do painel, com a marcação da fila do painel de
  análises (`.table-card` > `.table-head`, `.table-meta`, `.table-wrap` com
  `tbody#tableBody`) e o carregamento contínuo dele: 50 linhas por vez, e mais
  50 quando a rolagem chega perto do fim. A busca do cabeçalho vale só para a
  tabela. Clique na linha (ou Enter) abre a gaveta.
*/

const POR_VEZ = 50;
const PERTO_DO_FIM_PX = 160;
const LINHAS_DO_ESQUELETO = 8;
const COLUNAS = [
  ["Candidato", "19%"],
  ["Unidade / Edital", "16%"],
  ["Vaga / Cargo", "16%"],
  ["Modalidade", "10%"],
  ["Nota entrevista", "9%"],
  ["Parecer", "9%"],
  ["Compareceu", "8%"],
  ["Análise", "13%"],
];

export const MENSAGEM_SEM_ENTREVISTAS =
  "Nenhuma entrevista carregada para esta área ainda.";

export function SeloDoParecer({ parecer }) {
  return (
    <span className={`badge ${badgeDoParecer(parecer)}`}>
      {rotuloDoParecer(parecer)}
    </span>
  );
}

export function ResumoDaAnalise({ analise }) {
  if (!analise) return <span className="badge neutro">Sem análise</span>;
  return (
    <div>
      <div className="primary-text">{formatarNota(analise.nota)}</div>
      <span className="secondary-text">{analise.resultado || "—"}</span>
    </div>
  );
}

function LinhasDoEsqueleto() {
  return Array.from({ length: LINHAS_DO_ESQUELETO }, (_, linha) => (
    <tr key={linha} aria-hidden="true">
      {COLUNAS.map(([rotulo]) => (
        <td key={rotulo}>
          <span>&nbsp;</span>
        </td>
      ))}
    </tr>
  ));
}

export function TabelaDeEntrevistas({
  entrevistas,
  total,
  carregado,
  aoAbrir,
}) {
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(POR_VEZ);
  const naTabela = useMemo(
    () => filtrarEntrevistas(entrevistas, { ...FILTROS_VAZIOS, busca }),
    [entrevistas, busca],
  );
  useEffect(() => setLimite(POR_VEZ), [naTabela]);
  const visiveis = naTabela.slice(0, limite);
  const faltam = naTabela.length - visiveis.length;

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
    <section
      className="panel table-card"
      aria-labelledby="entrevistasTabelaTitulo"
    >
      <div className="table-head">
        <div>
          <h2 className="title" id="entrevistasTabelaTitulo">
            Entrevistas
          </h2>
        </div>
        <div className="table-tools">
          <input
            type="search"
            id="tableSearch"
            value={busca}
            disabled={!carregado}
            placeholder="Buscar somente na tabela"
            aria-label="Buscar somente na tabela de entrevistas"
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
              ? `${formatNumberBR(total)} ${total === 1 ? "entrevista" : "entrevistas"}`
              : `${formatNumberBR(naTabela.length)} de ${formatNumberBR(total)}`
            : "Carregando…"}{" "}
          · Carregamento contínuo
        </span>
      </div>
      <div className="table-wrap" onScroll={aoRolar}>
        <table>
          <thead>
            <tr>
              {COLUNAS.map(([rotulo, largura]) => (
                <th key={rotulo} scope="col" style={{ width: largura }}>
                  {rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody id="tableBody">
            {!carregado ? (
              <LinhasDoEsqueleto />
            ) : visiveis.length ? (
              visiveis.map((e) => (
                <tr
                  key={e.id}
                  className="entrevistas-linha"
                  tabIndex={0}
                  onClick={() => aoAbrir(e.id)}
                  onKeyDown={(evento) => {
                    if (
                      evento.target === evento.currentTarget &&
                      (evento.key === "Enter" || evento.key === " ")
                    ) {
                      evento.preventDefault();
                      aoAbrir(e.id);
                    }
                  }}
                  aria-label={`Entrevista de ${e.candidato}`}
                >
                  <td>
                    <div className="primary-text">{e.candidato}</div>
                    <span className="secondary-text">
                      {e.codigo ? `Cód. ${e.codigo}` : "Sem código"}
                    </span>
                  </td>
                  <td>
                    <div className="primary-text">{e.unidade || "—"}</div>
                    <span className="secondary-text">{e.edital}</span>
                    {e.semEdital ? (
                      <span className="badge pendente">Sem edital</span>
                    ) : null}
                  </td>
                  <td>
                    <div className="primary-text">{e.vaga || "—"}</div>
                    <span className="secondary-text">{e.cargo}</span>
                  </td>
                  <td>{e.modalidade || "—"}</td>
                  <td>
                    <div className="primary-text">{formatarNota(e.nota)}</div>
                    {e.divergente ? (
                      <span
                        className="badge revisar"
                        title={`Soma dos critérios: ${formatarNota(e.somaDasNotas)}`}
                      >
                        Divergente
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <SeloDoParecer parecer={e.parecer} />
                  </td>
                  <td>{rotuloDoComparecimento(e.compareceu)}</td>
                  <td>
                    <ResumoDaAnalise analise={e.analise} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={COLUNAS.length} className="empty">
                  {total
                    ? "Nenhum registro encontrado."
                    : MENSAGEM_SEM_ENTREVISTAS}
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
