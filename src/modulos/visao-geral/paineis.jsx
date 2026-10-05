import { useState } from "react";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.jsx";
import {
  anoDaSelecao,
  anosDosEditais,
  editaisDoAno,
} from "../../lib/atalhos-de-filtro.js";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  CAMPOS_DO_FILTRO,
  fasesDosProcessos,
  INDICADORES,
  posResultado,
  processosPorProjeto,
  rotuloDoAtalho,
  VALOR_DO_INDICADOR,
} from "../../lib/visao-geral.js";
import {
  ChipDeFiltro,
  ChipsDeFiltro,
  EstadoVazio,
  GradeDeKpis,
  Kpi,
  ListaDePendencias,
  MaisOpcoes,
  PainelDeFiltros,
  TopoDoPainel,
} from "../../ui/index.js";

/*
  Os blocos da Visão geral, com os componentes de src/ui/: o topo (a hora da
  carga, discreta, Atualizar e Exportar), os filtros (Ano e os cinco campos,
  dois deles em "Mais opções", e os chips do recorte), os sete indicadores,
  "Processos por projeto" (só Projetos), "Fases" e "Pós-resultado". Os
  prazos da semana ficam nas boas-vindas e os críticos no indicador.
*/

const fmt = (valor) => formatNumberBR(valor);
const plural = (n, um, varios) => `${fmt(n)} ${n === 1 ? um : varios}`;

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
    e.quantosFiltros +
    (e.busca.trim() ? 1 : 0) +
    (e.dsei.chave ? 1 : 0) +
    (e.atalho ? 1 : 0);
  return (
    <PainelDeFiltros
      tour="visao-geral-filtros"
      idDoTitulo="visaoGeralFiltrosTitulo"
      className="visao-geral-filtros"
      quantos={quantos}
      aoLimpar={estado.limparTudo}
      titulo={textos.filtros}
      subtitulo={textos.filtrosSubtitulo}
      rotuloMostrar={textos.mostrarFiltros}
      rotuloOcultar={textos.ocultarFiltros}
    >
      <div
        className="ui-grade-de-campos visao-geral-filtros-grade"
        data-tour="visao-geral-campos-do-filtro"
      >
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
        titulo="Mostrar Fase e UF"
      >
        {extras.map((c) => (
          <CampoDoFiltro key={c.campo} {...c} e={e} estado={estado} />
        ))}
      </MaisOpcoes>
      {quantos ? (
        <ChipsDeFiltro>
          {e.atalho ? (
            <ChipDeFiltro rotulo="Recorte" aoTirar={estado.tirarAtalho}>
              {rotuloDoAtalho(e.atalho)}
            </ChipDeFiltro>
          ) : null}
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
    <GradeDeKpis
      tour="visao-geral-kpis"
      className="visao-geral-kpis"
      rotulo={textos.indicadores}
    >
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
                  titulo: "Filtrar pelos críticos",
                  ativo: e.criticosAtivo,
                  aoClicar: estado.alternarCriticos,
                }
              : {})}
          />
        );
      })}
    </GradeDeKpis>
  );
}

/* ── Bloco com título e lista ───────────────────────────────────────── */

function Bloco({ id, titulo, className, children }) {
  return (
    <section
      className={`ui-card ui-pilha visao-geral-bloco ${className}`}
      aria-labelledby={id}
    >
      <h2 className="ui-titulo" id={id}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/* ── Processos por projeto (Projetos) ───────────────────────────────── */

export function ProcessosPorProjeto({ e, estado }) {
  const projetos = processosPorProjeto(e.filtradas);
  if (!e.carregado || !projetos.length) return null;
  const filtrado = e.filtros.unidade.length === 1 ? e.filtros.unidade[0] : null;
  return (
    <Bloco
      id="visaoGeralProjetosTitulo"
      titulo="Processos por projeto"
      className="visao-geral-projetos"
    >
      <div
        className="visao-geral-itens visao-geral-itens-grade"
        data-tour="visao-geral-processos-por-projeto"
      >
        {projetos.map(({ projeto, processos, abertos, vagas, contratadas }) => (
          <button
            key={projeto}
            type="button"
            className="visao-geral-item"
            aria-pressed={filtrado === projeto}
            title={`Filtrar por ${projeto}`}
            onClick={() =>
              estado.alternarFiltroUnico(
                "unidade",
                projeto,
                "Filtro de projeto",
              )
            }
          >
            <span className="visao-geral-item-topo">
              <b title={projeto}>{projeto}</b>
              <span className="visao-geral-item-conta">{fmt(processos)}</span>
            </span>
            <small>
              {[
                plural(abertos, "aberto", "abertos"),
                plural(vagas, "vaga", "vagas"),
                plural(contratadas, "contratada", "contratadas"),
              ].join(" · ")}
            </small>
          </button>
        ))}
      </div>
    </Bloco>
  );
}

/* ── Fases ──────────────────────────────────────────────────────────── */

export function Fases({ e, estado }) {
  const fases = fasesDosProcessos(e.filtradas);
  const filtrada = e.filtros.fase.length === 1 ? e.filtros.fase[0] : null;
  return (
    <Bloco
      id="visaoGeralFasesTitulo"
      titulo="Fases"
      className="visao-geral-fases"
    >
      {!e.carregado ? (
        <div className="ui-esqueleto ui-esqueleto-linha" aria-hidden="true" />
      ) : e.filtradas.length ? (
        <div className="visao-geral-itens">
          {fases.map(({ fase, quantos, pct, tom }) => (
            <button
              key={fase}
              type="button"
              className="visao-geral-item"
              data-tom={tom}
              data-fase={fase}
              aria-pressed={filtrada === fase}
              disabled={!quantos && filtrada !== fase}
              title={`Filtrar pela fase ${fase}`}
              onClick={() =>
                estado.alternarFiltroUnico("fase", fase, "Filtro de fase")
              }
            >
              <span className="visao-geral-item-topo">
                <b title={fase}>{fase}</b>
                <small>{pct}%</small>
                <span className="visao-geral-item-conta">{fmt(quantos)}</span>
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
    </Bloco>
  );
}

/* ── Pós-resultado ──────────────────────────────────────────────────── */

export function PosResultado({ e, estado }) {
  const itens = posResultado(e.filtradas, { comListas: e.comListas })
    .filter(({ quantos, codigo }) => quantos || e.atalho === `pos:${codigo}`)
    .map(({ codigo, rotulo, quantos, pessoas }) => ({
      chave: codigo,
      titulo: rotulo,
      detalhe: [
        plural(quantos, "edital", "editais"),
        pessoas !== null ? plural(pessoas, "pessoa", "pessoas") : "",
      ]
        .filter(Boolean)
        .join(" · "),
      tom: codigo === "sem_lista" ? "perigo" : "alerta",
      ativo: e.atalho === `pos:${codigo}`,
      aoClicar: () => estado.alternarAtalho(`pos:${codigo}`),
    }));
  return (
    <Bloco
      id="visaoGeralPosResultadoTitulo"
      titulo="Pós-resultado"
      className="visao-geral-pos-resultado"
    >
      <ListaDePendencias
        itens={itens}
        carregando={!e.carregado}
        vazio="Nenhuma pendência."
      />
    </Bloco>
  );
}
