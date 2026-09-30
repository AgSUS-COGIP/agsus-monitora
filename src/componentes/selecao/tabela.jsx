import { useEffect, useMemo, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  FILTROS_VAZIOS,
  filtrarVagas,
  formatarQuantidade,
  rotuloDaOrigem,
} from "../../lib/selecao-do-painel.js";
import { Modal } from "../modal.jsx";
import { Kv, Secao, TopoDaGaveta } from "../recursos/partes.jsx";

/*
  "Vagas": a tabela do painel, com a marcação da fila do painel de análises
  (`.table-card` > `.table-head`, `.table-meta`, `.table-wrap` com
  `tbody#tableBody`) e o carregamento contínuo dele: 50 linhas por vez. A
  busca do cabeçalho vale só para a tabela. Clique na linha (ou Enter) abre a
  gaveta com o funil completo da vaga.
*/

const POR_VEZ = 50;
const PERTO_DO_FIM_PX = 160;
const LINHAS_DO_ESQUELETO = 8;
const COLUNAS = [
  ["Vaga / Cargo", "22%"],
  ["Unidade / Edital", "18%"],
  ["Inscritos", "8%"],
  ["Aptos", "7%"],
  ["Eliminados", "8%"],
  ["Triados", "7%"],
  ["Convocados", "10%"],
  ["Aprovados", "7%"],
  ["Contratados", "7%"],
  ["Não contratados", "6%"],
];

export const MENSAGEM_SEM_VAGAS =
  "Nenhuma vaga carregada para esta área ainda.";

function SeloDaOrigem({ origem }) {
  return origem === "entrevistas" ? null : (
    <span
      className="badge neutro"
      title="Edital sem entrevista no MONITORA: total da planilha Auditoria"
    >
      Planilha
    </span>
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

export function TabelaDeVagas({ vagas, total, carregado, aoAbrir }) {
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(POR_VEZ);
  const naTabela = useMemo(
    () => filtrarVagas(vagas, { ...FILTROS_VAZIOS, busca }),
    [vagas, busca],
  );
  useEffect(() => setLimite(POR_VEZ), [naTabela]);
  const visiveis = naTabela.slice(0, limite);
  const faltam = naTabela.length - visiveis.length;
  const n = formatarQuantidade;

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
          <span className="eyebrow">Detalhes</span>
          <h2 className="title" id="selecaoTabelaTitulo">
            Vagas
          </h2>
          <p className="hint">
            Abra uma vaga para ver o funil completo e a observação da planilha.
          </p>
        </div>
        <div className="table-tools">
          <input
            type="search"
            id="tableSearch"
            value={busca}
            disabled={!carregado}
            placeholder="Buscar somente na tabela"
            aria-label="Buscar somente na tabela de vagas"
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>
      </div>
      <div className="table-meta">
        <span id="tableInfo">
          {carregado
            ? `Mostrando ${formatNumberBR(visiveis.length)} de ${formatNumberBR(naTabela.length)} vagas`
            : "Mostrando 0 de 0 vagas"}
        </span>
        <span id="pageInfo">
          {carregado
            ? naTabela.length === total
              ? `${formatNumberBR(total)} ${total === 1 ? "vaga" : "vagas"}`
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
              visiveis.map((v) => (
                <tr
                  key={v.id}
                  className="selecao-linha"
                  tabIndex={0}
                  onClick={() => aoAbrir(v.id)}
                  onKeyDown={(evento) => {
                    if (
                      evento.target === evento.currentTarget &&
                      (evento.key === "Enter" || evento.key === " ")
                    ) {
                      evento.preventDefault();
                      aoAbrir(v.id);
                    }
                  }}
                  aria-label={`Vaga ${v.vaga || v.cargo}`}
                >
                  <td>
                    <div className="primary-text">{v.cargo || "—"}</div>
                    <span className="secondary-text">
                      {v.vaga ? `Vaga ${v.vaga}` : "Outra banca"}
                    </span>
                    {v.aConferir ? (
                      <span className="badge revisar">A conferir</span>
                    ) : null}
                  </td>
                  <td>
                    <div className="primary-text">{v.unidade || "—"}</div>
                    <span className="secondary-text">{v.edital}</span>
                    {v.semEdital ? (
                      <span className="badge pendente">Sem edital</span>
                    ) : null}
                  </td>
                  <td>{n(v.inscritos)}</td>
                  <td>{n(v.aptos)}</td>
                  <td>{n(v.totalEliminados)}</td>
                  <td>{n(v.triados)}</td>
                  <td>
                    <div className="primary-text">{n(v.convocados)}</div>
                    <SeloDaOrigem origem={v.origemConvocados} />
                  </td>
                  <td>{n(v.aprovados)}</td>
                  <td>{n(v.contratados)}</td>
                  <td>{n(v.naoContratados)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={COLUNAS.length} className="empty">
                  {total ? "Nenhuma vaga encontrada." : MENSAGEM_SEM_VAGAS}
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
            ? `${formatNumberBR(visiveis.length)} de ${formatNumberBR(naTabela.length)} vagas · role a tabela para carregar mais`
            : `Todas as ${formatNumberBR(naTabela.length)} vagas do recorte foram carregadas`}
        </div>
      ) : null}
    </section>
  );
}

/* ── Gaveta: o funil completo da vaga ─────────────────────────────────── */

export function GavetaDaVaga({ vaga: v, aoFechar }) {
  const n = formatarQuantidade;
  return (
    <Modal
      id="selecaoGaveta"
      rotuloId="selecaoGavetaTitulo"
      aoFechar={aoFechar}
      className="analises-drawer-backdrop selecao-gaveta"
      cartaoClassName="analises-drawer"
    >
      <TopoDaGaveta
        sobretitulo={v.vaga ? `Vaga ${v.vaga}` : "Outra banca"}
        titulo={v.cargo || v.vagaPlanilha}
        tituloId="selecaoGavetaTitulo"
        rotuloDoFechar="Fechar detalhe"
        aoFechar={aoFechar}
        resumo={
          <>
            <span className="status">
              <i className="fa-solid fa-users" aria-hidden="true" />
              {n(v.inscritos)} inscritos
            </span>
            {v.semEdital ? <span>Sem edital cadastrado</span> : null}
            {v.aConferir ? <span>Números a conferir</span> : null}
          </>
        }
      />
      <div className="analises-drawer-context">
        <div>
          <small>Edital</small>
          <strong>{v.edital || "—"}</strong>
        </div>
        <div>
          <small>Unidade</small>
          <strong>{v.unidade || "—"}</strong>
        </div>
      </div>
      <div id="analisesDrawerBody">
        <div className="detail-shell">
          <Secao icone="fa-filter" titulo="Análise curricular" secao="analise">
            <div className="analises-detail-section-grid">
              <Kv rotulo="Inscritos">{n(v.inscritos)}</Kv>
              <Kv rotulo="Aptos para análise">{n(v.aptos)}</Kv>
              <Kv rotulo="Cancelados">{n(v.cancelados)}</Kv>
              <Kv rotulo="Não finalizaram o questionário">
                {n(v.reprovadosQuestionario)}
              </Kv>
              <Kv rotulo="Eliminados por nota">{n(v.eliminadosNota)}</Kv>
              <Kv rotulo="Reprovados na análise">{n(v.reprovadosAnalise)}</Kv>
              <Kv rotulo="Triados">{n(v.triados)}</Kv>
              <Kv rotulo="Total de eliminados">{n(v.totalEliminados)}</Kv>
            </div>
          </Secao>
          <Secao icone="fa-comments" titulo="Entrevista" secao="entrevista">
            <div className="analises-detail-section-grid">
              <Kv rotulo="Convocados para entrevista">{n(v.convocados)}</Kv>
              <Kv rotulo="De onde vem">{rotuloDaOrigem(v.origemConvocados)}</Kv>
            </div>
          </Secao>
          <Secao
            icone="fa-user-check"
            titulo="Lista de aprovados"
            secao="lista"
          >
            {v.temLista ? (
              <div className="analises-detail-section-grid">
                <Kv rotulo="Aprovados">{n(v.aprovados)}</Kv>
                <Kv rotulo="Contratados (Contratado ou Migração)">
                  {n(v.contratados)}
                </Kv>
                <Kv rotulo="Não contratados">{n(v.naoContratados)}</Kv>
              </div>
            ) : (
              <div className="analises-detail-analysis">
                <span className="analises-detail-empty">
                  {v.semEdital
                    ? "O edital da planilha não foi encontrado no MONITORA."
                    : "O edital ainda não tem lista de aprovados vigente."}
                </span>
              </div>
            )}
          </Secao>
          {v.observacao ? (
            <Secao
              icone="fa-circle-info"
              titulo="Observação"
              secao="observacao"
            >
              <div className="analises-detail-analysis">
                <span>{v.observacao}</span>
              </div>
            </Secao>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
