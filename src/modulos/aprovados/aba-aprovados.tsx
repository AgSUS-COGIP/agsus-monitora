import type {
  CandidatoDaTabelaDeAprovados,
  EstadoDaAbaDeAprovados,
  PropsDaAbaDeAprovados,
} from "./tipos-da-aba-de-aprovados.ts";
import type { ConvocacoesDaTabela } from "./tipos-da-aba-de-convocacao.ts";
import type {
  ChaveDaOrdemDosAprovados,
  OrdemDosAprovados,
} from "../../lib/aprovados/ordem-dos-aprovados.ts";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  OPCOES_DO_FILTRO_DE_STATUS,
  filterApprovedCandidates,
  nomeDosCandidatosFiltrados,
  summarizeApprovedCandidates,
} from "../../lib/aprovados/lista-aprovados-rules.ts";
import {
  SEM_ORDEM,
  ordenarAprovados,
  proximaOrdemDosAprovados,
} from "../../lib/aprovados/ordem-dos-aprovados.ts";
import { formatNumberBR } from "../../lib/base/formatters";
import {
  acoesDaLinhaDoAprovado,
  type IdDaAcaoDoAprovado,
} from "../../lib/aprovados/acoes-da-linha-dos-aprovados.ts";
import {
  cargoDaVaga,
  localidadeDoCargo,
} from "../../lib/aprovados/localidade-da-vaga.ts";
import {
  alcanceDaSelecao,
  marcarPagina,
  mesmaPagina,
} from "../../lib/base/alcance-da-selecao.ts";
import { resumoDasOrigens } from "../../lib/aprovados/publicacao-de-aprovados.ts";
import { statusDoLotePara } from "../../lib/aprovados/status-em-lote-dos-aprovados.ts";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.tsx";
import {
  BUSCAR_NESTA_TABELA,
  AcoesDaLinha,
  BarraDeSelecao,
  Campo,
  GradeDeKpis,
  Kpi,
  PainelDeFiltros,
  TabelaInfinita,
  classes,
} from "../../ui/index.ts";
import {
  ModalidadeDoCandidato,
  NOME_DOS_CANDIDATOS,
  NomeDoCandidato,
  NotaDoCandidato,
  plural,
  SeloDeStatus,
} from "./partes.tsx";
import { ModalDoStatusEmLote } from "./status-em-lote.tsx";

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

  Revisão de 17/11/2026: o código da vaga, o cargo, a lotação (o lugar no
  texto do cargo: localidade-da-vaga.ts) e o edital com a unidade têm coluna
  própria, todas ordenáveis; as ações da linha são uma principal com nome
  ("Mudar status" ou "Abrir") e o "⋯ Mais ações de <nome>"
  (acoes-da-linha-dos-aprovados.ts), com "Ver na Classificação" do edital.

  Status em lote (11/11/2026): quem muda status marca as linhas e usa "Mudar
  status" (status-em-lote.tsx). Desde a revisão de 17/11/2026 a barra da
  seleção (BarraDeSelecao) separa "Selecionar esta página" (as linhas
  desenhadas) de "Selecionar todos os N resultados" (os filtrados e
  buscados), e a janela diz quantos serão afetados. Mudar filtro ou busca
  limpa a seleção.

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
  { rotulo: "Nome", chave: "nome", largura: "19%" },
  { rotulo: "Vaga", chave: "vaga", largura: "8%" },
  { rotulo: "Cargo", chave: "cargo", largura: "12%" },
  { rotulo: "Lotação", chave: "lotacao", largura: "11%" },
  { rotulo: "Edital", chave: "edital", largura: "10%" },
  { rotulo: "Modalidade", chave: "modalidade", largura: "9%" },
  {
    rotulo: "Classificação",
    chave: "classificacao",
    numero: true,
    largura: "7%",
  },
  { rotulo: "Nota", chave: "nota", numero: true, largura: "6%" },
  { rotulo: "Situação", chave: "situacao", largura: "9%" },
  { rotulo: "Ações", largura: "9%" },
];

/* Sem `convocacoes`, o mesmo Map sempre (a linha memorizada compara por referência). */
const SEM_CONVOCACOES: ConvocacoesDaTabela = new Map();

/* O clique que caiu num botão, link ou campo da linha é dele, e não da linha. */
const doControle = (alvo: EventTarget | null) =>
  alvo instanceof Element &&
  Boolean(alvo.closest("button, a, input, select, textarea, label"));

/*
  As ações da linha: a principal com nome e o "⋯ Mais ações de <nome>". O
  `data-approved-action` de cada uma é o contrato dos testes e do tour.
*/
function AcoesDoAprovado({
  row,
  estado,
  perfil,
  anexos,
}: {
  row: CandidatoDaTabelaDeAprovados;
  estado: EstadoDaAbaDeAprovados;
  perfil: unknown;
  anexos: number;
}) {
  const id = row.candidato_id;
  const fazer: Record<IdDaAcaoDoAprovado, () => void> = {
    status: () => estado.abrirStatus(id),
    candidato: () => estado.abrirCandidato(id),
    anexos: () => estado.abrirAnexos(id),
    carta: () => estado.abrirCarta([id]),
    classificacao: () =>
      estado.irParaClassificacao(String(row.edital_id ?? ""), text(row.edital)),
    "alteracao-judicial": () => estado.abrirAlteracaoJudicial(id),
    "remove-subjudice": () => void estado.removerSubJudice(id),
  };
  const { principal, outras } = acoesDaLinhaDoAprovado(perfil, row, anexos);
  // Enquanto uma ação grava, as do menu esperam (o que o BotaoDeAcao fazia).
  const { acao: emCurso } = useSyncExternalStore(estado.assinar, estado.obter);
  const removendo = emCurso?.tipo === `remover-sub-judice:${id}`;
  return (
    <AcoesDaLinha
      pessoa={row.nome}
      principal={{
        rotulo: principal.rotulo,
        acao: principal.id,
        dados: {
          "data-approved-action": principal.id,
          "data-candidate-id": id,
        },
        titulo: `${principal.rotulo}: ${row.nome}`,
        aoClicar: fazer[principal.id],
      }}
      outras={outras.map((acao) => ({
        id: acao.id,
        rotulo:
          acao.id === "remove-subjudice" && removendo
            ? "Removendo…"
            : acao.rotulo,
        desabilitado:
          acao.desabilitado ||
          (acao.id === "remove-subjudice" && Boolean(emCurso)),
        dados: { "data-approved-action": acao.id, "data-candidate-id": id },
        aoEscolher: fazer[acao.id],
      }))}
    />
  );
}

/*
  A linha é memorizada: carregar mais 50 (ou abrir um modal) não redesenha as
  linhas já na tela — com milhares delas, era isso que pesava na rolagem.
*/
const LinhaDoAprovado = memo(function LinhaDoAprovado({
  row,
  estado,
  perfil,
  anexos,
  convocacoes,
  selecionado = false,
  aoSelecionar,
}: {
  row: CandidatoDaTabelaDeAprovados;
  estado: EstadoDaAbaDeAprovados;
  perfil: unknown;
  anexos: ReadonlyMap<string, readonly unknown[]>;
  convocacoes: ConvocacoesDaTabela;
  selecionado?: boolean;
  /** Sem ela (quem não muda status), a linha não tem caixa de seleção. */
  aoSelecionar?: (id: string) => void;
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
        {aoSelecionar ? (
          <input
            type="checkbox"
            className="approved-selecao"
            data-selecao-do-candidato
            checked={selecionado}
            aria-label={`Selecionar ${row.nome}`}
            onChange={() => aoSelecionar(row.candidato_id)}
          />
        ) : null}
        <NomeDoCandidato candidato={row} aoAbrir={estado.abrirCandidato} />
      </td>
      <td data-coluna="vaga">{text(row.codigo_vaga) || "-"}</td>
      <td data-coluna="cargo" title={text(row.cargo) || undefined}>
        {cargoDaVaga(row.cargo) || "-"}
      </td>
      <td data-coluna="lotacao">{localidadeDoCargo(row.cargo) || "-"}</td>
      <td data-coluna="edital">
        {text(row.edital) || "-"}
        {text(row.unidade) ? (
          <span className="approved-unidade">{text(row.unidade)}</span>
        ) : null}
      </td>
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
        <AcoesDoAprovado
          row={row}
          estado={estado}
          perfil={perfil}
          anexos={anexos.get(String(row.candidato_id))?.length ?? 0}
        />
      </td>
    </tr>
  );
});

export function AbaAprovados({
  ativa,
  estado,
  perfil,
  candidatos,
  listas = [],
  anexos,
  convocacoes = SEM_CONVOCACOES,
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

  // Status em lote: a seleção (ids) vale para as linhas da tabela de agora.
  const podeSelecionar = statusDoLotePara(perfil).length > 0;
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [loteAberto, setLoteAberto] = useState(false);
  useEffect(() => {
    setSelecionados(new Set());
  }, [chaveDosFiltros, busca]);
  const daTabela = useMemo(
    () => pelaBusca(ordenadas, busca),
    [ordenadas, busca],
  );
  const escolhidos = useMemo(
    () => daTabela.filter((row) => selecionados.has(row.candidato_id)),
    [daTabela, selecionados],
  );
  // A "página": as linhas que a tabela desenhou (TabelaInfinita.aoMostrar).
  const [pagina, setPagina] = useState<readonly string[]>([]);
  const aoMostrar = useCallback(
    (visiveis: readonly CandidatoDaTabelaDeAprovados[]) => {
      const ids = visiveis.map((row) => row.candidato_id);
      setPagina((atual) => (mesmaPagina(atual, ids) ? atual : ids));
    },
    [],
  );
  const recorte = useMemo(
    () => daTabela.map((row) => row.candidato_id),
    [daTabela],
  );
  const alcance = useMemo(
    () => alcanceDaSelecao(selecionados, pagina, recorte),
    [selecionados, pagina, recorte],
  );
  const alternar = useCallback((id: string) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);
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
          {opcoes.localidades.length ? (
            <Campo rotulo="Localidade" idDoControle="approvedFilterLocalidade">
              <MultiSelectBusca
                id="approvedFilterLocalidade"
                placeholder="Todas as localidades"
                opcoes={opcoes.localidades}
                selecionados={filtros.localidade}
                aoMudar={(valores) => aoMudarFiltro("localidade", valores)}
              />
            </Campo>
          ) : null}
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
      {podeSelecionar && carregado && daTabela.length ? (
        <BarraDeSelecao
          className="approved-lote"
          rotulo="Seleção de candidatos"
          tour="aprovados-selecao"
          alcance={alcance}
          nome={NOME_DOS_CANDIDATOS}
          aoMarcarPagina={(sim) =>
            setSelecionados((atual) => marcarPagina(atual, pagina, sim))
          }
          aoMarcarTodos={() => setSelecionados(new Set(recorte))}
          aoLimpar={() => setSelecionados(new Set())}
        >
          <button
            type="button"
            className="btn small"
            data-abrir-status-em-lote
            onClick={() => setLoteAberto(true)}
          >
            Mudar status
          </button>
        </BarraDeSelecao>
      ) : null}
      {loteAberto ? (
        <ModalDoStatusEmLote
          estado={estado}
          perfil={perfil}
          candidatos={escolhidos}
          alcance={alcance}
          aoFechar={() => setLoteAberto(false)}
          aoConcluir={() => {
            setLoteAberto(false);
            setSelecionados(new Set());
          }}
        />
      ) : null}
      <TabelaInfinita
        tour="aprovados-tabela"
        idDoTitulo="approvedTabelaTitulo"
        titulo="Candidatos aprovados"
        className="approved-page-card"
        classeDaTabela="approved-table"
        idDoCorpo="approvedRows"
        busca={{
          placeholder: BUSCAR_NESTA_TABELA,
          rotulo: "Buscar nesta tabela de aprovados",
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
        aoMostrar={aoMostrar}
        linha={(row) => (
          <LinhaDoAprovado
            key={row.candidato_id}
            row={row}
            estado={estado}
            perfil={perfil}
            anexos={anexos}
            convocacoes={convocacoes}
            selecionado={selecionados.has(row.candidato_id)}
            aoSelecionar={podeSelecionar ? alternar : undefined}
          />
        )}
      />
    </div>
  );
}
