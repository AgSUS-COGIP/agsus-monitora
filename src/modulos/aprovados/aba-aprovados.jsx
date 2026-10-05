import { useEffect, useRef } from "react";
import {
  OPCOES_DO_FILTRO_DE_STATUS,
  canAlterarCandidatoSubJudice,
  canEditSubJudice,
  summarizeApprovedCandidates,
} from "../../lib/lista-aprovados-rules.js";
import { formatNumberBR } from "../../lib/formatters.js";
import { resumoDasOrigens } from "../../lib/publicacao-de-aprovados.js";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.jsx";
import {
  BotaoDeAcao,
  Campo,
  GradeDeKpis,
  Kpi,
  LinhasEsqueleto,
  PainelDeFiltros,
  classes,
} from "../../ui/index.js";
import {
  AcaoDeAnexos,
  AcaoDeCarta,
  AcaoDeStatus,
  ModalidadeDoCandidato,
  NomeDoCandidato,
  NotaDoCandidato,
  Paginacao,
  SeloDeStatus,
} from "./partes.jsx";

/*
  A aba "Lista de aprovados": indicadores, filtros e a tabela paginada.

  Os filtros e a página moram em `lista-aprovados.jsx`, porque o contador do topo
  da página também os lê. A lista inteira continua em memória; o que a
  paginação corta é o custo de DESENHAR — com milhares de candidatos, montar
  todas as linhas a cada escolha num filtro travava o navegador.

  A origem das listas (publicada da Classificação ou manual, por planilha) fica
  numa linha discreta acima da tabela: a do edital, quando o filtro deixa um só.

  Antes da primeira carga, KPIs e linhas são skeleton; se ela falha, o aviso
  com "Tentar novamente" fica no topo da tela e a tabela diz "Sem dados.".
*/

const text = (value) => String(value ?? "").trim();

const COLUNAS = 7;

export function AbaAprovados({
  ativa,
  estado,
  perfil,
  candidatos,
  listas = [],
  anexos,
  convocacoes = new Map(),
  carregado,
  erroAoCarregar,
  opcoes,
  filtros,
  aoMudarFiltro,
  aoLimparFiltros,
  pagina,
  tamanho,
  aoIrPara,
  aoMudarTamanho,
}) {
  const tabela = useRef(null);
  const resumo = summarizeApprovedCandidates(candidatos, filtros);
  const carregando = !carregado && !erroAoCarregar;
  const quantos = Object.values(filtros).filter((lista) => lista.length).length;
  const origens = carregado
    ? resumoDasOrigens(
        filtros.editalId?.length
          ? listas.filter((l) => filtros.editalId.includes(String(l.edital_id)))
          : listas,
      )
    : "";

  // As linhas novas precisam dos rótulos do modo cartão (menu ≤ 900px).
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [pagina.rows]);

  function irPara(destino) {
    if (!aoIrPara(destino)) return;
    // Trocar de página com a tabela rolada deixaria a pessoa a meio da lista.
    tabela.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }

  const kpi = (idDoValor, chave, tom, icone, rotulo, valor) => (
    <Kpi
      idDoValor={idDoValor}
      chave={chave}
      tom={tom}
      icone={icone}
      rotulo={rotulo}
      valor={formatNumberBR(valor)}
      carregando={carregando}
    />
  );

  return (
    <div
      id="approvedPanelAprovados"
      className={classes("approved-tabpanel", !ativa && "hidden")}
      role="tabpanel"
      aria-labelledby="approvedTabAprovados"
    >
      <GradeDeKpis
        className="approved-kpis"
        rotulo="Resumo da lista de aprovados"
      >
        {kpi(
          "approvedKpiTotal",
          "total",
          "info",
          "fa-users",
          "Total de aprovados",
          resumo.total,
        )}
        {kpi(
          "approvedKpiContratado",
          "contratado",
          "sucesso",
          "fa-user-check",
          "Contratados",
          resumo.contratado,
        )}
        {kpi(
          "approvedKpiDesistente",
          "desistente",
          "perigo",
          "fa-user-xmark",
          "Desistentes",
          resumo.desistente,
        )}
        {kpi(
          "approvedKpiMigracao",
          "migracao",
          "destaque",
          "fa-right-left",
          "Migração",
          resumo.migracao,
        )}
        {kpi(
          "approvedKpiDocumentacaoRejeitada",
          "documentacao-rejeitada",
          "alerta",
          "fa-file-circle-xmark",
          "Documentação rejeitada",
          resumo.documentacaoRejeitada,
        )}
        {kpi(
          "approvedKpiConvocado",
          "convocado",
          "alerta",
          "fa-envelope-open-text",
          "Convocados",
          resumo.convocado,
        )}
      </GradeDeKpis>

      <PainelDeFiltros
        idDoTitulo="approvedFiltrosTitulo"
        className="approved-filters"
        quantos={quantos}
        aoLimpar={aoLimparFiltros}
      >
        <div className="ui-grade-de-campos">
          <Campo rotulo="Edital" idDoControle="approvedFilterEdital">
            <MultiSelectBusca
              id="approvedFilterEdital"
              placeholder="Todos os editais"
              opcoes={opcoes.editais}
              selecionados={filtros.editalId}
              aoMudar={(valores) => aoMudarFiltro("editalId", valores)}
            />
          </Campo>
          <Campo rotulo="Cargo" idDoControle="approvedFilterCargo">
            <MultiSelectBusca
              id="approvedFilterCargo"
              placeholder="Todos os cargos"
              opcoes={opcoes.cargos}
              selecionados={filtros.cargo}
              aoMudar={(valores) => aoMudarFiltro("cargo", valores)}
            />
          </Campo>
          <Campo rotulo="Modalidade" idDoControle="approvedFilterModalidade">
            <MultiSelectBusca
              id="approvedFilterModalidade"
              placeholder="Todas as modalidades"
              opcoes={opcoes.modalidades}
              selecionados={filtros.modalidade}
              aoMudar={(valores) => aoMudarFiltro("modalidade", valores)}
            />
          </Campo>
          <Campo rotulo="Status" idDoControle="approvedFilterStatus">
            <MultiSelectBusca
              id="approvedFilterStatus"
              placeholder="Todos os status"
              opcoes={OPCOES_DO_FILTRO_DE_STATUS}
              selecionados={filtros.status}
              aoMudar={(valores) => aoMudarFiltro("status", valores)}
            />
          </Campo>
        </div>
      </PainelDeFiltros>

      {origens ? (
        <p className="status-discreto" data-origem-das-listas>
          {origens}
        </p>
      ) : null}
      <section
        className="ui-card ui-tabela approved-page-card"
        aria-label="Candidatos aprovados"
      >
        <div className="ui-tabela-rolagem" ref={tabela}>
          <table className="approved-table">
            <thead>
              <tr>
                {/* Nome primeiro: é por ele que se procura; na última coluna
                    ficava cortado pela rolagem horizontal. */}
                <th scope="col">Nome</th>
                <th scope="col">Cargo</th>
                <th scope="col">Modalidade</th>
                <th scope="col" className="num">
                  Classificação
                </th>
                <th scope="col" className="num">
                  Nota
                </th>
                <th scope="col">Status</th>
                <th scope="col" className="approved-th-acoes">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody id="approvedRows" aria-busy={carregando || undefined}>
              {carregando ? (
                <LinhasEsqueleto colunas={COLUNAS} />
              ) : erroAoCarregar ? (
                <tr>
                  <td colSpan={COLUNAS} className="ui-vazio">
                    Sem dados.
                  </td>
                </tr>
              ) : pagina.rows.length ? (
                pagina.rows.map((row) => (
                  <tr key={row.candidato_id}>
                    <td>
                      <NomeDoCandidato
                        candidato={row}
                        aoAbrir={estado.abrirCandidato}
                      />
                    </td>
                    <td>{row.cargo || "-"}</td>
                    <td>
                      <ModalidadeDoCandidato candidato={row} />
                    </td>
                    <td className="num">{row.classificacao ?? "-"}</td>
                    <td className="num">
                      <NotaDoCandidato candidato={row} />
                    </td>
                    <td>
                      <SeloDeStatus
                        status={text(row.status)}
                        dataConvocacao={
                          convocacoes.get(String(row.candidato_id))?.data
                        }
                      />
                    </td>
                    <td className="approved-actions">
                      <div className="approved-actions-grupo">
                        <AcaoDeAnexos
                          candidato={row}
                          anexos={anexos.get(String(row.candidato_id))}
                          aoAbrir={estado.abrirAnexos}
                        />
                        <AcaoDeStatus
                          perfil={perfil}
                          candidato={row}
                          atributos={{ "data-approved-action": "status" }}
                          aoAbrir={estado.abrirStatus}
                        />
                        <AcaoDeCarta
                          perfil={perfil}
                          candidato={row}
                          atributos={{ "data-approved-action": "carta" }}
                          aoAbrir={estado.abrirCarta}
                        />
                        {canAlterarCandidatoSubJudice(perfil, row) ? (
                          <button
                            type="button"
                            className="approved-icone-acao"
                            data-approved-action="alteracao-judicial"
                            data-candidate-id={row.candidato_id}
                            title="Alterar nota ou modalidade por decisão judicial"
                            aria-label={`Alterar nota ou modalidade de ${row.nome} por decisão judicial`}
                            onClick={() =>
                              estado.abrirAlteracaoJudicial(row.candidato_id)
                            }
                          >
                            <i
                              className="fa-solid fa-gavel"
                              aria-hidden="true"
                            />
                          </button>
                        ) : null}
                        {canEditSubJudice(perfil, row) ? (
                          <BotaoDeAcao
                            estado={estado}
                            acao={`remover-sub-judice:${row.candidato_id}`}
                            soIcone
                            className="btn icon red"
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
                          </BotaoDeAcao>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={COLUNAS} className="ui-vazio">
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
      </section>
    </div>
  );
}
