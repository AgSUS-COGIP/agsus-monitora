import { useState } from "react";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.jsx";
import {
  anoDaSelecao,
  anosDosEditais,
  editaisDoAno,
} from "../../lib/atalhos-de-filtro.js";
import { formatNumberBR } from "../../lib/formatters.js";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
import {
  CAMPOS_DO_FILTRO,
  INDICADORES,
  VALOR_DO_INDICADOR,
  processosEmAtencao,
  resumoPorEtapa,
  statusOperacional,
  statusSelecionados,
  unidadesComMaisDeUmProcesso,
} from "../../lib/visao-geral.js";
import {
  CardDeGrafico,
  ChipDeFiltro,
  ChipsDeFiltro,
  classes,
  EstadoVazio,
  Grafico,
  GradeDeKpis,
  Kpi,
  ListaDePendencias,
  MaisOpcoes,
  paletaDosGraficos,
  PainelDeFiltros,
  Selo,
  TopoDoPainel,
} from "../../ui/index.js";

/*
  Os blocos da Visão geral, com os componentes de src/ui/: o topo (a hora da
  carga, discreta, Atualizar e Exportar), os filtros (Ano e os seis campos,
  três deles em "Mais opções", e os chips do recorte), os seis indicadores,
  "Unidades com mais de um processo seletivo", o resumo por etapa, o status
  operacional (rosca e legenda que filtram) e "Atenção".
*/

const fmt = (valor) => formatNumberBR(valor);

/* ── Topo ───────────────────────────────────────────────────────────── */

const horaCurta = (tempo) =>
  new Date(tempo).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function Topo({ e, aoExportar }) {
  const status = !e.carregado
    ? "Carregando dados..."
    : e.carregadoEm
      ? `Atualizado às ${horaCurta(e.carregadoEm)}`
      : "";
  return (
    <TopoDoPainel
      status={status}
      aoAtualizar={() => void window.refreshData?.()}
      aoExportar={aoExportar}
      exportarDesativado={!e.carregado || !e.linhasDaArea.length}
    />
  );
}

/* ── Filtros ────────────────────────────────────────────────────────── */

function CampoDoFiltro({ campo, rotulo, todos, e, estado }) {
  const id = `visaoGeralFiltro-${campo}`;
  return (
    <div className="ui-campo">
      <label htmlFor={id}>{rotulo}</label>
      {e.carregado ? (
        <MultiSelectBusca
          id={id}
          opcoes={e.opcoes[campo]}
          selecionados={e.filtros[campo]}
          placeholder={todos}
          aoMudar={(valores) => estado.definirFiltro(campo, valores)}
        />
      ) : (
        <select id={id} disabled>
          <option>{todos}</option>
        </select>
      )}
    </div>
  );
}

/*
  Ano: escolhe todos os editais daquele ano entre as opções de Edital (os
  anos saem dos números, "11/2026"). Outra seleção de editais é "Seleção
  própria".
*/
function CampoDoAno({ e, estado }) {
  const editais = e.opcoes.edital;
  const atual = anoDaSelecao(e.filtros.edital, editais);
  return (
    <div className="ui-campo">
      <label htmlFor="visaoGeralFiltroAno">Ano</label>
      <select
        id="visaoGeralFiltroAno"
        value={atual}
        disabled={!e.carregado}
        onChange={(evento) => {
          const ano = evento.target.value;
          if (ano === "personalizado") return;
          estado.definirFiltro("edital", ano ? editaisDoAno(editais, ano) : []);
        }}
      >
        <option value="">Todos os anos</option>
        {anosDosEditais(editais).map((ano) => (
          <option key={ano} value={String(ano)}>
            {ano}
          </option>
        ))}
        {atual === "personalizado" ? (
          <option value="personalizado" disabled>
            Seleção própria
          </option>
        ) : null}
      </select>
    </div>
  );
}

const resumoDosValores = (valores) =>
  valores.length > 2 ? `${valores.length} selecionados` : valores.join(", ");

export function Filtros({ e, estado, textos }) {
  const extras = CAMPOS_DO_FILTRO.filter((c) => c.mais);
  const extrasAtivos = extras.filter((c) => e.filtros[c.campo].length).length;
  const [maisAberto, setMaisAberto] = useState(extrasAtivos > 0);
  const quantos =
    e.quantosFiltros + (e.busca.trim() ? 1 : 0) + (e.dsei.chave ? 1 : 0);
  return (
    <PainelDeFiltros
      idDoTitulo="visaoGeralFiltrosTitulo"
      className="visao-geral-filtros"
      quantos={quantos}
      aoLimpar={estado.limparTudo}
      titulo={textos.filtros}
      subtitulo={textos.filtrosSubtitulo}
      rotuloMostrar={textos.mostrarFiltros}
      rotuloOcultar={textos.ocultarFiltros}
    >
      <div className="ui-grade-de-campos visao-geral-filtros-grade">
        <CampoDoAno e={e} estado={estado} />
        {CAMPOS_DO_FILTRO.filter((c) => !c.mais).map((c) => (
          <CampoDoFiltro key={c.campo} {...c} e={e} estado={estado} />
        ))}
      </div>
      <MaisOpcoes
        id="visaoGeralMaisFiltros"
        aberto={maisAberto}
        aoAlternar={() => setMaisAberto((aberto) => !aberto)}
        quantos={extrasAtivos}
        titulo="Mostrar Etapa, Risco e UF"
      >
        {extras.map((c) => (
          <CampoDoFiltro key={c.campo} {...c} e={e} estado={estado} />
        ))}
      </MaisOpcoes>
      {quantos ? (
        <ChipsDeFiltro>
          {e.dsei.chave ? (
            <ChipDeFiltro rotulo="DSEI" aoTirar={estado.tirarDsei}>
              {e.dsei.nome || e.dsei.chave}
            </ChipDeFiltro>
          ) : null}
          {CAMPOS_DO_FILTRO.filter((c) => e.filtros[c.campo].length).map(
            ({ campo, rotulo }) => (
              <ChipDeFiltro
                key={campo}
                rotulo={rotulo}
                aoTirar={() => estado.definirFiltro(campo, [])}
              >
                {resumoDosValores(e.filtros[campo])}
              </ChipDeFiltro>
            ),
          )}
          {e.busca.trim() ? (
            <ChipDeFiltro
              rotulo="Busca"
              aoTirar={() => estado.definirBusca("")}
            >
              {e.busca.trim()}
            </ChipDeFiltro>
          ) : null}
        </ChipsDeFiltro>
      ) : null}
    </PainelDeFiltros>
  );
}

/* ── Indicadores ────────────────────────────────────────────────────── */

export function Indicadores({ e, estado, textos }) {
  return (
    <GradeDeKpis className="visao-geral-kpis" rotulo={textos.indicadores}>
      {INDICADORES.map(([chave, , icone, tom]) => {
        const critico = chave === "kpi_criticos_label";
        return (
          <Kpi
            key={chave}
            chave={VALOR_DO_INDICADOR[chave]}
            tom={tom}
            icone={icone}
            rotulo={textos.rotulos[chave]}
            valor={fmt(e.indicadores[VALOR_DO_INDICADOR[chave]])}
            carregando={!e.carregado}
            {...(critico
              ? {
                  titulo: "Filtrar por risco Médio e Alto",
                  ativo: e.riscoCriticoAtivo,
                  aoClicar: estado.alternarRiscoCritico,
                }
              : {})}
          />
        );
      })}
    </GradeDeKpis>
  );
}

/* ── Unidades com mais de um processo seletivo ──────────────────────── */

export function UnidadesComVariosProcessos({ e, estado }) {
  const unidades = unidadesComMaisDeUmProcesso(e.filtradas);
  if (!unidades.length) return null;
  const filtrada = e.filtros.unidade.length === 1 ? e.filtros.unidade[0] : null;
  return (
    <section
      className="ui-card visao-geral-unidades"
      aria-labelledby="visaoGeralUnidadesTitulo"
    >
      <h2 className="ui-titulo" id="visaoGeralUnidadesTitulo">
        <i className="fa-solid fa-layer-group" aria-hidden="true" /> Unidades
        com mais de um processo seletivo
      </h2>
      <div className="visao-geral-unidades-lista">
        {unidades.map(({ unidade, quantos }) => (
          <button
            key={unidade}
            type="button"
            className="visao-geral-unidade"
            aria-pressed={filtrada === unidade}
            title={`Filtrar por ${unidade}`}
            onClick={() =>
              estado.alternarFiltroUnico(
                "unidade",
                unidade,
                "Filtro de unidade",
              )
            }
          >
            <span>{unidade}</span>
            <Selo tom="revisar">{fmt(quantos)}</Selo>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Resumo por etapa ───────────────────────────────────────────────── */

export function ResumoPorEtapa({ e, estado, textos }) {
  const etapas = resumoPorEtapa(e.filtradas);
  const filtrada = e.filtros.etapa.length === 1 ? e.filtros.etapa[0] : null;
  return (
    <section
      className="ui-card ui-pilha visao-geral-etapas"
      aria-labelledby="visaoGeralEtapasTitulo"
    >
      <h2 className="ui-titulo" id="visaoGeralEtapasTitulo">
        {textos.resumo}
      </h2>
      {!e.carregado ? (
        <div className="ui-esqueleto ui-esqueleto-linha" aria-hidden="true" />
      ) : etapas.length ? (
        <div className="visao-geral-etapas-lista">
          {etapas.map(({ etapa, quantos, pct, tom }) => (
            <button
              key={etapa}
              type="button"
              className="visao-geral-etapa"
              data-tom={tom}
              aria-pressed={filtrada === etapa}
              title={`Filtrar pela etapa ${etapa}`}
              onClick={() =>
                estado.alternarFiltroUnico("etapa", etapa, "Filtro de etapa")
              }
            >
              <span className="visao-geral-etapa-topo">
                <b title={etapa}>{etapa}</b>
                <small>{pct}%</small>
                <span className="visao-geral-etapa-conta">{fmt(quantos)}</span>
              </span>
              <span className="visao-geral-barra" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EstadoVazio>Sem dados.</EstadoVazio>
      )}
    </section>
  );
}

/* ── Status operacional ─────────────────────────────────────────────── */

function lerToken(nome, reserva) {
  const estilo =
    typeof getComputedStyle === "function"
      ? getComputedStyle(document.documentElement)
      : null;
  return estilo?.getPropertyValue(nome).trim() || reserva;
}

/* A cor de cada tom do gráfico, dos tokens (o tema escuro vem junto). */
export function coresDosTons(escuro) {
  const p = paletaDosGraficos(escuro, paletaDoPainel(escuro));
  return {
    sucesso: p.ok,
    info: p.blue,
    destaque: lerToken("--series-3", "#1a9fc8"),
    alerta: lerToken("--series-4", "#8e6cf2"),
    perigo: p.bad,
    neutro: p.neutro,
    borda: p.surface,
  };
}

export function StatusOperacional({ e, estado, textos, escuro }) {
  const { total, itens } = statusOperacional(e.filtradas);
  const ativos = statusSelecionados(e.filtros);
  const cores = coresDosTons(escuro);
  const assinatura = itens.map((i) => `${i.status}:${i.quantos}`).join("|");
  return (
    <CardDeGrafico
      titulo={textos.status}
      className="visao-geral-status"
      carregando={!e.carregado}
    >
      <div className="visao-geral-status-corpo">
        <div className="visao-geral-rosca">
          <Grafico
            tipo="doughnut"
            rotulo="Processos por status operacional"
            dependencias={[assinatura, escuro]}
            montar={() => ({
              data: {
                labels: itens.map((i) => i.status),
                datasets: [
                  {
                    data: itens.map((i) => i.quantos),
                    backgroundColor: itens.map((i) => cores[i.tom]),
                    borderColor: cores.borda,
                    borderWidth: 3,
                    hoverOffset: 6,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                cutout: "72%",
                plugins: {
                  legend: { display: false },
                  tooltip: { enabled: false },
                },
                onClick: (_evento, elementos) => {
                  const item = itens[elementos?.[0]?.index];
                  if (item) estado.alternarStatus(item.status);
                },
              },
            })}
          />
          <div className="visao-geral-rosca-centro" aria-hidden="true">
            <strong>{fmt(total)}</strong>
            <span>processos</span>
          </div>
        </div>
        <div className="visao-geral-legenda">
          {itens.map(({ status, quantos, pct, tom }) => (
            <button
              key={status}
              type="button"
              className="visao-geral-legenda-item"
              aria-pressed={ativos.has(status)}
              title={`Filtrar por ${status}`}
              onClick={() => estado.alternarStatus(status)}
            >
              <span
                className="visao-geral-ponto"
                style={{ background: cores[tom] }}
                aria-hidden="true"
              />
              <span className="visao-geral-legenda-nome">{status}</span>
              <strong>{fmt(quantos)}</strong>
              <small>{pct}%</small>
              <span className="visao-geral-barra" aria-hidden="true">
                <i style={{ width: `${pct}%`, background: cores[tom] }} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </CardDeGrafico>
  );
}

/* ── Atenção ────────────────────────────────────────────────────────── */

export function Atencao({ e, textos, aoAbrir }) {
  const itens = processosEmAtencao(e.filtradas).map((linha) => {
    const alto = String(linha.risco || "").toLowerCase() === "alto";
    return {
      chave: String(linha.id),
      titulo: linha.edital || "-",
      detalhe: [
        `Risco ${String(linha.risco || "-").toLowerCase()}`,
        linha.etapa || "Etapa não informada",
        linha.unidade,
      ]
        .filter(Boolean)
        .join(" · "),
      tom: alto ? "perigo" : "alerta",
      aoClicar: () => aoAbrir(linha),
    };
  });
  return (
    <section
      className={classes("ui-card ui-pilha visao-geral-atencao")}
      aria-labelledby="visaoGeralAtencaoTitulo"
    >
      <h2 className="ui-titulo" id="visaoGeralAtencaoTitulo">
        {textos.atencao}
      </h2>
      <ListaDePendencias
        itens={itens}
        carregando={!e.carregado}
        vazio="Nenhum processo em risco médio ou alto."
      />
    </section>
  );
}
