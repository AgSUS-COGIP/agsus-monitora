import type {
  CandidatoDaTabelaDeAprovados,
  EstadoDaAbaDeAprovados,
  PropsDaAbaDeAprovados,
} from "./tipos-da-aba-de-aprovados.ts";
import type { ConvocacoesDaTabela } from "./tipos-da-aba-de-convocacao.ts";
import type {
  ChaveDaOrdemDosAprovados,
  OrdemDosAprovados,
} from "../../lib/ordem-dos-aprovados.ts";
import { useMemo, useState } from "react";
import {
  OPCOES_DO_FILTRO_DE_STATUS,
  canAlterarCandidatoSubJudice,
  canEditSubJudice,
  filterApprovedCandidates,
  nomeDosCandidatosFiltrados,
  summarizeApprovedCandidates,
} from "../../lib/lista-aprovados-rules.ts";
import {
  SEM_ORDEM,
  ordenarAprovados,
  proximaOrdemDosAprovados,
} from "../../lib/ordem-dos-aprovados.ts";
import { formatNumberBR } from "../../lib/formatters";
import { resumoDasOrigens } from "../../lib/publicacao-de-aprovados.ts";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.tsx";
import {
  BotaoDeAcao,
  Campo,
  GradeDeKpis,
  Kpi,
  PainelDeFiltros,
  TabelaInfinita,
  classes,
} from "../../ui/index.ts";
import {
  AcaoDeAnexos,
  AcaoDeCarta,
  AcaoDeStatus,
  ModalidadeDoCandidato,
  NomeDoCandidato,
  NotaDoCandidato,
  plural,
  SeloDeStatus,
} from "./partes.tsx";

/*
  A aba "Lista de aprovados": indicadores, filtros e a tabela.

  A tabela é a das outras telas (TabelaInfinita, src/ui/): 50 linhas por vez
  e mais 50 ao rolar (ou no "Carregar mais"), cabeçalho fixo, "Mostrando N de
  M", busca só da tabela e ordenação pelo cabeçalho. A lista inteira da área
  já está em memória (o pacote compacto): a rolagem contínua só corta o custo
  de DESENHAR — com milhares de candidatos, montar todas as linhas a cada
  escolha num filtro travava o navegador. Filtrar, buscar e ordenar mexem só
  nas linhas já carregadas; números consolidados vêm do pacote.

  Os filtros e a busca moram em `lista-aprovados.tsx`, porque o contador do
  topo da página também os lê, e "Limpar filtros" limpa a busca junto.

  Clique na linha (ou Enter/Espaço com ela em foco) abre a gaveta do
  candidato, como o nome; os botões da linha fazem só a própria ação.

  A origem das listas (publicada da Classificação ou manual, por planilha) fica
  numa linha discreta acima da tabela: a do edital, quando o filtro deixa um só.

  Antes da primeira carga, KPIs e linhas são skeleton; se ela falha, o aviso
  com "Tentar novamente" fica no topo da tela e a tabela diz "Sem dados.".
*/

const text = (value: unknown) => String(value ?? "").trim();

/* A busca da tabela: nome, cargo, edital… (a regra do filtro). Estável, de módulo. */
const pelaBusca = (
  linhas: readonly CandidatoDaTabelaDeAprovados[],
  busca: string,
) =>
  text(busca) ? filterApprovedCandidates(linhas, { query: busca }) : linhas;

const COLUNAS: ReadonlyArray<{
  rotulo: string;
  chave?: ChaveDaOrdemDosAprovados;
  numero?: boolean;
  largura?: string;
}> = [
  // Nome primeiro: é por ele que se procura; na última coluna ficava cortado
  // pela rolagem horizontal.
  { rotulo: "Nome", chave: "nome", largura: "26%" },
  { rotulo: "Cargo", chave: "cargo", largura: "17%" },
  { rotulo: "Modalidade", chave: "modalidade", largura: "14%" },
  {
    rotulo: "Classificação",
    chave: "classificacao",
    numero: true,
    largura: "9%",
  },
  { rotulo: "Nota", chave: "nota", numero: true, largura: "7%" },
  { rotulo: "Situação", chave: "situacao", largura: "13%" },
  { rotulo: "Ações", largura: "14%" },
];

/* O clique que caiu num botão, link ou campo da linha é dele, e não da linha. */
const doControle = (alvo: EventTarget | null) =>
  alvo instanceof Element &&
  Boolean(alvo.closest("button, a, input, select, textarea, label"));

function LinhaDoAprovado({
  row,
  estado,
  perfil,
  anexos,
  convocacoes,
}: {
  row: CandidatoDaTabelaDeAprovados;
  estado: EstadoDaAbaDeAprovados;
  perfil: unknown;
  anexos: ReadonlyMap<string, readonly unknown[]>;
  convocacoes: ConvocacoesDaTabela;
}) {
  const abrir = () => estado.abrirCandidato(row.candidato_id);
  return (
    <tr
      className="approved-linha"
      tabIndex={0}
      aria-label={`Candidato ${row.nome}`}
      onClick={(evento) => {
        if (!doControle(evento.target)) abrir();
      }}
      onKeyDown={(evento) => {
        if (
          evento.target === evento.currentTarget &&
          (evento.key === "Enter" || evento.key === " ")
        ) {
          evento.preventDefault();
          abrir();
        }
      }}
    >
      <td>
        <NomeDoCandidato candidato={row} aoAbrir={estado.abrirCandidato} />
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
          situacao={text(row.contratacao_situacao)}
          motivo={text(row.contratacao_motivo)}
          dataConvocacao={convocacoes.get(String(row.candidato_id))?.data}
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
              onClick={() => estado.abrirAlteracaoJudicial(row.candidato_id)}
            >
              <i className="fa-solid fa-gavel" aria-hidden="true" />
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
              onClick={() => void estado.removerSubJudice(row.candidato_id)}
            >
              <i className="fa-solid fa-user-minus" aria-hidden="true" />
            </BotaoDeAcao>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

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
  linhas,
  busca,
  aoBuscar,
}: PropsDaAbaDeAprovados) {
  const [ordem, setOrdem] = useState<OrdemDosAprovados>(SEM_ORDEM);
  const chaveDosFiltros = JSON.stringify(filtros);
  const resumo = useMemo(
    () => summarizeApprovedCandidates(candidatos, filtros),
    // `filtros` chega novo a cada desenho; a chave é o conteúdo.
    [candidatos, chaveDosFiltros],
  );
  const ordenadas = useMemo(
    () => ordenarAprovados(linhas, ordem),
    [linhas, ordem],
  );
  const colunas = useMemo(
    () =>
      COLUNAS.map(({ chave, ...coluna }) =>
        chave
          ? {
              ...coluna,
              chave,
              ordem: ordem.chave === chave ? ordem.sentido : "",
              aoOrdenar: () =>
                setOrdem((atual) => proximaOrdemDosAprovados(atual, chave)),
            }
          : coluna,
      ),
    [ordem],
  );
  const carregando = !carregado && !erroAoCarregar;
  const quantos = Object.values(filtros).filter((lista) => lista.length).length;
  const origens = carregado
    ? resumoDasOrigens(
        filtros.editalId?.length
          ? listas.filter((l) => filtros.editalId.includes(String(l.edital_id)))
          : listas,
      )
    : "";

  const kpi = (
    idDoValor: string,
    chave: string,
    tom: string,
    icone: string,
    rotulo: string,
    valor: number,
  ) => (
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
      data-tour="aprovados-painel-aprovados"
      className={classes("approved-tabpanel", !ativa && "hidden")}
      role="tabpanel"
      aria-labelledby="approvedTabAprovados"
    >
      <GradeDeKpis
        tour="aprovados-kpis"
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
          // Nas outras telas (Visão geral, Seleção) "Contratados" soma Contratado + Migração;
          // aqui as duas situações têm card próprio.
          "Contratados (sem migração)",
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
        {kpi(
          "approvedKpiContratadoEmOutraLista",
          "contratado-em-outra-lista",
          "neutro",
          "fa-copy",
          // Fora dos contratados: a pessoa já conta pela outra linha do edital.
          "Contratados em outra lista",
          resumo.contratadoEmOutraLista,
        )}
      </GradeDeKpis>

      <PainelDeFiltros
        tour="aprovados-filtros"
        idDoTitulo="approvedFiltrosTitulo"
        className="approved-filters"
        quantos={quantos}
        podeLimpar={quantos > 0 || Boolean(busca)}
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
          <Campo rotulo="Situação" idDoControle="approvedFilterStatus">
            <MultiSelectBusca
              id="approvedFilterStatus"
              placeholder="Todas as situações"
              opcoes={OPCOES_DO_FILTRO_DE_STATUS}
              selecionados={filtros.status}
              aoMudar={(valores) => aoMudarFiltro("status", valores)}
            />
          </Campo>
        </div>
      </PainelDeFiltros>

      {filtros.candidatos?.length ? (
        <p className="approved-filtro-do-aviso" data-filtro-do-aviso>
          <span>
            {[
              nomeDosCandidatosFiltrados(candidatos, filtros.candidatos),
              plural(filtros.candidatos.length, "vaga", "vagas"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <button
            type="button"
            className="btn secondary"
            onClick={() => aoMudarFiltro("candidatos", [])}
          >
            Ver todos
          </button>
        </p>
      ) : null}
      {origens ? (
        <p
          className="status-discreto"
          data-origem-das-listas
          data-tour="aprovados-origem-das-listas"
        >
          {origens}
        </p>
      ) : null}
      <TabelaInfinita
        tour="aprovados-tabela"
        idDoTitulo="approvedTabelaTitulo"
        titulo="Candidatos aprovados"
        className="approved-page-card"
        classeDaTabela="approved-table"
        idDoCorpo="approvedRows"
        busca={{
          placeholder: "Buscar somente na tabela",
          rotulo: "Buscar somente na tabela de aprovados",
          id: "approvedBusca",
          valor: busca,
          aoMudar: aoBuscar,
        }}
        // Com a carga falha, a tabela sai do esqueleto e diz "Sem dados.".
        carregado={carregado || Boolean(erroAoCarregar)}
        itens={ordenadas}
        filtrarPelaBusca={pelaBusca}
        colunas={colunas}
        total={erroAoCarregar ? 0 : linhas.length}
        vazio={
          erroAoCarregar
            ? "Sem dados."
            : candidatos.length
              ? "Nenhum candidato encontrado para os filtros selecionados."
              : "Nenhum candidato aprovado nesta área."
        }
        informacao={(quantos) =>
          quantos === null
            ? "Carregando…"
            : quantos === candidatos.length
              ? plural(quantos, "candidato", "candidatos")
              : `${formatNumberBR(quantos)} de ${plural(candidatos.length, "candidato", "candidatos")}`
        }
        linha={(row) => (
          <LinhaDoAprovado
            key={row.candidato_id}
            row={row}
            estado={estado}
            perfil={perfil}
            anexos={anexos}
            convocacoes={convocacoes}
          />
        )}
      />
    </div>
  );
}
