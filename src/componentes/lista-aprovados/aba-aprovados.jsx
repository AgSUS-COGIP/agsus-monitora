import { useEffect, useRef } from "react";
import {
  OPCOES_DO_FILTRO_DE_STATUS,
  canEditSubJudice,
  formatarNota,
  modalidadeSemAspas,
  summarizeApprovedCandidates,
} from "../../lib/lista-aprovados-rules.js";
import { MultiSelectBusca } from "../multi-select-busca.jsx";
import {
  AcaoDeStatus,
  Kpi,
  NomeDoCandidato,
  Paginacao,
  SeloDeStatus,
  classes,
} from "./partes.jsx";

/*
  A aba "Lista de aprovados": indicadores, filtros e a tabela paginada.

  Os filtros e a página moram em `lista-aprovados.jsx`, porque o contador do
  cabeçalho da página também os lê. A lista inteira continua em memória; o que
  a paginação corta é o custo de DESENHAR — com milhares de candidatos, montar
  todas as linhas a cada escolha num filtro travava o navegador.
*/

const text = (value) => String(value ?? "").trim();

const COLUNAS = 7;

export function AbaAprovados({
  ativa,
  estado,
  perfil,
  candidatos,
  carregado,
  opcoes,
  filtros,
  aoMudarFiltro,
  pagina,
  tamanho,
  aoIrPara,
  aoMudarTamanho,
}) {
  const tabela = useRef(null);
  const resumo = summarizeApprovedCandidates(candidatos, filtros);

  // As linhas novas precisam dos rótulos do modo cartão (menu ≤ 900px).
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [pagina.rows]);

  function irPara(destino) {
    if (!aoIrPara(destino)) return;
    // Trocar de página com a tabela rolada deixaria a pessoa a meio da lista.
    tabela.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }

  return (
    <div
      id="approvedPanelAprovados"
      className={classes("approved-tabpanel", !ativa && "hidden")}
      role="tabpanel"
      aria-labelledby="approvedTabAprovados"
    >
      <div className="approved-kpis" aria-label="Resumo da lista de aprovados">
        <Kpi
          id="approvedKpiTotal"
          tom="total"
          icone="fa-users"
          rotulo="Total de aprovados"
          valor={resumo.total}
          carregado={carregado}
        />
        <Kpi
          id="approvedKpiContratado"
          tom="success"
          icone="fa-user-check"
          rotulo="Contratados"
          valor={resumo.contratado}
          carregado={carregado}
        />
        <Kpi
          id="approvedKpiDesistente"
          tom="danger"
          icone="fa-user-xmark"
          rotulo="Desistentes"
          valor={resumo.desistente}
          carregado={carregado}
        />
        <Kpi
          id="approvedKpiMigracao"
          tom="info"
          icone="fa-right-left"
          rotulo="Migração"
          valor={resumo.migracao}
          carregado={carregado}
        />
        <Kpi
          id="approvedKpiDocumentacaoRejeitada"
          tom="warning"
          icone="fa-file-circle-xmark"
          rotulo="Documentação rejeitada"
          valor={resumo.documentacaoRejeitada}
          carregado={carregado}
        />
        <Kpi
          id="approvedKpiFimDeFila"
          tom="fila"
          icone="fa-arrow-turn-down"
          rotulo="Fim de fila"
          valor={resumo.fimDeFila}
          carregado={carregado}
        />
      </div>

      <div className="approved-filters">
        <div className="form-row">
          <label htmlFor="approvedFilterEdital">Edital</label>
          <MultiSelectBusca
            id="approvedFilterEdital"
            placeholder="Todos os editais"
            opcoes={opcoes.editais}
            selecionados={filtros.editalId}
            aoMudar={(valores) => aoMudarFiltro("editalId", valores)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="approvedFilterCargo">Cargo</label>
          <MultiSelectBusca
            id="approvedFilterCargo"
            placeholder="Todos os cargos"
            opcoes={opcoes.cargos}
            selecionados={filtros.cargo}
            aoMudar={(valores) => aoMudarFiltro("cargo", valores)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="approvedFilterModalidade">Modalidade</label>
          <MultiSelectBusca
            id="approvedFilterModalidade"
            placeholder="Todas as modalidades"
            opcoes={opcoes.modalidades}
            selecionados={filtros.modalidade}
            aoMudar={(valores) => aoMudarFiltro("modalidade", valores)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="approvedFilterStatus">Status</label>
          <MultiSelectBusca
            id="approvedFilterStatus"
            placeholder="Todos os status"
            opcoes={OPCOES_DO_FILTRO_DE_STATUS}
            selecionados={filtros.status}
            aoMudar={(valores) => aoMudarFiltro("status", valores)}
          />
        </div>
      </div>
      <div className="table-meta">
        Listas inativas permanecem consultáveis, mas seus candidatos não podem
        ser alterados.
      </div>
      <div className="table-wrap" ref={tabela}>
        <table className="approved-table">
          <thead>
            <tr>
              {/* Nome primeiro: é por ele que se procura; na última coluna
                  ficava cortado pela rolagem horizontal. */}
              <th>Nome</th>
              <th>Cargo</th>
              <th>Modalidade</th>
              <th className="num">Classificação</th>
              <th className="num">Nota</th>
              <th>Status</th>
              <th style={{ textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody id="approvedRows">
            {!carregado ? (
              <tr>
                <td colSpan={COLUNAS} className="approved-empty">
                  Carregando lista de aprovados...
                </td>
              </tr>
            ) : pagina.rows.length ? (
              pagina.rows.map((row) => (
                <tr key={row.candidato_id}>
                  <td>
                    <NomeDoCandidato candidato={row} />
                  </td>
                  <td>{row.cargo || "-"}</td>
                  <td>{modalidadeSemAspas(row.modalidade) || "-"}</td>
                  <td className="num">{row.classificacao ?? "-"}</td>
                  <td className="num">{formatarNota(row.nota)}</td>
                  <td>
                    <SeloDeStatus status={text(row.status)} />
                  </td>
                  <td className="approved-actions">
                    <AcaoDeStatus
                      perfil={perfil}
                      candidato={row}
                      atributos={{ "data-approved-action": "status" }}
                      aoAbrir={estado.abrirStatus}
                    />
                    {canEditSubJudice(perfil, row) ? (
                      <button
                        className="btn icon red"
                        type="button"
                        data-approved-action="remove-subjudice"
                        data-candidate-id={row.candidato_id}
                        title="Remover sub judice"
                        aria-label={`Remover ${row.nome} da lista como sub judice`}
                        onClick={() =>
                          void estado.removerSubJudice(row.candidato_id)
                        }
                      >
                        <i
                          className="fa-solid fa-user-minus"
                          aria-hidden="true"
                        />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={COLUNAS} className="approved-empty">
                  Nenhum candidato encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginacao
        prefixo="approved"
        pagina={pagina}
        tamanho={tamanho}
        unidade="candidatos"
        aoIrPara={irPara}
        aoMudarTamanho={aoMudarTamanho}
      />
    </div>
  );
}
