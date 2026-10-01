import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  esteiraDosRecursos,
  FILTROS_VAZIOS,
  impactoNoResultado,
  recursosPorAnalista,
  recursosPorSituacao,
} from "../../lib/recursos-dos-candidatos.js";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
import {
  Campo,
  CardDeGrafico,
  ChipDeFiltro,
  ChipsDeFiltro,
  Grafico,
  GradeDeKpis,
  Kpi as CardDeKpi,
  LinhaDoRecorte,
  ListaDePendencias,
  MaisOpcoes,
  MarcasDoRecorte,
  paletaDosGraficos,
  PainelDeFiltros,
  TopoDoPainel,
} from "../../ui/index.js";

/*
  Os blocos da tela de Recursos, com os componentes de src/ui/: o topo (só
  status e ações — o título e a área estão no cabeçalho do app), "Refinar
  resultados", as duas fileiras de KPIs em card compacto (as que filtram são
  botões), o recorte ativo, os gráficos Chart.js e as pendências prioritárias.
*/

const truncar = (valor, limite) => {
  const texto = String(valor ?? "").trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
};

/* ── Topo ───────────────────────────────────────────────────────────── */

export function Topo({ aoNovo, novoDesativado, aoModelos, ...props }) {
  return (
    <TopoDoPainel {...props}>
      {aoModelos ? (
        <button
          type="button"
          className="btn secondary"
          data-acao="modelos"
          title="Modelos de resposta aos recursos (administração)"
          onClick={aoModelos}
        >
          <i className="fa-solid fa-file-signature" aria-hidden="true" />{" "}
          Modelos de resposta
        </button>
      ) : null}
      {aoNovo ? (
        <button
          type="button"
          className="btn"
          data-acao="novo-recurso"
          disabled={novoDesativado}
          onClick={aoNovo}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Novo recurso
        </button>
      ) : null}
    </TopoDoPainel>
  );
}

/* ── Filtros ────────────────────────────────────────────────────────── */

export const CAMPOS_DO_FILTRO = [
  ["edital", "Edital", "editais", "Todos os editais"],
  ["origem", "Origem", "origens", "Todas as origens"],
  ["analista", "Analista", "analistas", "Todos os analistas"],
  ["situacao", "Situação", "situacoes", "Todas as situações"],
  ["pendencia", "Pendência", "pendencias", "Qualquer pendência"],
];

const rotuloDoValor = (opcoes, lista, valor) =>
  opcoes[lista].find((o) => o.valor === valor)?.rotulo || valor;

/** Os filtros ativos, como o recorte os descreve: `[campo, rótulo, valor]`. */
export function filtrosAtivos(filtros, opcoes) {
  const ativos = CAMPOS_DO_FILTRO.filter(([campo]) => filtros[campo]).map(
    ([campo, rotulo, lista]) => [
      campo,
      rotulo,
      rotuloDoValor(opcoes, lista, filtros[campo]),
    ],
  );
  if (String(filtros.busca || "").trim())
    ativos.push(["busca", "Busca", filtros.busca.trim()]);
  return ativos;
}

export function Filtros({ filtros, opcoes, carregado, aoMudar, aoLimpar }) {
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const ativos = filtrosAtivos(filtros, opcoes);
  const avancados = String(filtros.busca || "").trim() ? 1 : 0;

  return (
    <PainelDeFiltros
      idDoTitulo="recursosFiltrosTitulo"
      quantos={ativos.length}
      aoLimpar={aoLimpar}
      aoRecolher={() => setMaisOpcoes(false)}
    >
      <div className="ui-grade-de-campos">
        {CAMPOS_DO_FILTRO.map(([campo, rotulo, lista, todos]) => (
          <Campo rotulo={rotulo} key={campo}>
            <select
              id={`filtro-${campo}`}
              name={campo}
              value={filtros[campo]}
              disabled={!carregado}
              onChange={(evento) => aoMudar(campo, evento.target.value)}
            >
              <option value="">{todos}</option>
              {opcoes[lista].map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        ))}
      </div>
      <MaisOpcoes
        id="recursosFiltrosAdicionais"
        aberto={maisOpcoes}
        aoAlternar={() => setMaisOpcoes((atual) => !atual)}
        quantos={avancados}
        titulo="Mostrar a busca em toda a tela"
      >
        <Campo rotulo="Buscar em toda a tela">
          <input
            id="filtro-busca"
            type="search"
            name="busca"
            value={filtros.busca}
            disabled={!carregado}
            placeholder="Candidato, código, vaga, nº ou processo SEI"
            onChange={(evento) => aoMudar("busca", evento.target.value)}
          />
        </Campo>
      </MaisOpcoes>
      <ChipsDeFiltro>
        {ativos.map(([campo, rotulo, valor]) => (
          <ChipDeFiltro
            key={campo}
            rotulo={rotulo}
            aoTirar={() => aoMudar(campo, FILTROS_VAZIOS[campo])}
          >
            {valor}
          </ChipDeFiltro>
        ))}
      </ChipsDeFiltro>
    </PainelDeFiltros>
  );
}

/* ── KPIs ───────────────────────────────────────────────────────────── */

/* O card de KPI de src/ui/ com o número formatado; os que filtram são botões. */
function Kpi({ valor, sufixo = "", aoFiltrar, carregado, ...props }) {
  return (
    <CardDeKpi
      valor={`${formatNumberBR(valor)}${sufixo}`}
      aoClicar={aoFiltrar}
      carregando={!carregado}
      {...props}
    />
  );
}

export function Indicadores({ indicadores: k, carregado, filtros, aoFiltrar }) {
  const filtro = (campo, valor) =>
    carregado
      ? {
          ativo: filtros[campo] === valor,
          aoFiltrar: () => aoFiltrar(campo, valor),
        }
      : {};
  return (
    <GradeDeKpis className="recursos-kpis" rotulo="Indicadores">
      <Kpi
        cor="k-cyan"
        icone="fa-layer-group"
        chave="total"
        rotulo="Total de recursos"
        valor={k.total}
        carregado={carregado}
      />
      <Kpi
        cor="k-yellow"
        icone="fa-clock"
        chave="em-analise"
        rotulo="Em análise"
        valor={k.pendentes}
        carregado={carregado}
        {...filtro("situacao", "EM_ANALISE")}
      />
      <Kpi
        cor="k-green"
        icone="fa-gavel"
        chave="decididos"
        rotulo="Decididos"
        valor={k.concluidos}
        carregado={carregado}
      />
      <Kpi
        cor="k-red"
        icone="fa-triangle-exclamation"
        chave="prazo-vencido"
        rotulo="Prazo vencido"
        valor={k.atrasados}
        carregado={carregado}
        {...filtro("pendencia", "prazo_vencido")}
      />
      <Kpi
        cor="k-red"
        icone="fa-file-circle-xmark"
        chave="sem-sei"
        rotulo="Sem processo SEI"
        valor={k.semSei}
        carregado={carregado}
        {...filtro("pendencia", "sem_sei")}
      />
      <Kpi
        cor="k-yellow"
        icone="fa-envelope-open-text"
        chave="sem-resposta"
        rotulo="Sem resposta enviada"
        valor={k.semResposta}
        carregado={carregado}
      />
      <Kpi
        cor="k-purple"
        icone="fa-right-left"
        chave="mudou-resultado"
        rotulo="Mudou nota/classificação"
        valor={k.mudouResultado}
        carregado={carregado}
        {...filtro("pendencia", "mudou_resultado")}
      />
      <Kpi
        cor="k-slate"
        icone="fa-chart-simple"
        chave="taxa"
        rotulo="Taxa de conclusão"
        valor={k.taxaConclusao}
        sufixo="%"
        carregado={carregado}
      />
    </GradeDeKpis>
  );
}

/*
  A resposta escrita no sistema (resposta-do-recurso.js): em revisão,
  aprovadas aguardando envio e devolvidas. Uma segunda fileira de KPIs; cada
  um filtra pela pendência dele.
*/
export function IndicadoresDasRespostas({
  indicadores: k,
  carregado,
  filtros,
  aoFiltrar,
}) {
  const filtro = (valor) =>
    carregado
      ? {
          ativo: filtros.pendencia === valor,
          aoFiltrar: () => aoFiltrar("pendencia", valor),
        }
      : {};
  return (
    <GradeDeKpis
      className="recursos-kpis recursos-kpis-respostas"
      rotulo="Indicadores das respostas"
    >
      <Kpi
        cor="k-yellow"
        icone="fa-file-pen"
        chave="respostas-em-revisao"
        rotulo="Respostas em revisão"
        valor={k.respostasEmRevisao}
        carregado={carregado}
        {...filtro("resposta_em_revisao")}
      />
      <Kpi
        cor="k-green"
        icone="fa-file-circle-check"
        chave="respostas-aprovadas"
        rotulo="Aprovadas aguardando envio"
        valor={k.respostasAprovadas}
        carregado={carregado}
        {...filtro("resposta_aprovada")}
      />
      <Kpi
        cor="k-red"
        icone="fa-rotate-left"
        chave="respostas-devolvidas"
        rotulo="Respostas devolvidas"
        valor={k.respostasDevolvidas}
        carregado={carregado}
        {...filtro("resposta_devolvida")}
      />
    </GradeDeKpis>
  );
}

/* ── Recorte ativo ──────────────────────────────────────────────────── */

export function Recorte({ ativos, recursos, carregado }) {
  const vencidos = recursos.filter((r) => r.atrasado).length;
  const semPrazo = recursos.filter((r) => !r.prazo.data).length;
  const pelaAbertura = recursos.filter(
    (r) => r.prazo.fonte === "abertura",
  ).length;
  const marcas = [
    {
      chave: "vencidos",
      tom: vencidos ? "alerta" : "sucesso",
      icone: vencidos ? "fa-triangle-exclamation" : "fa-circle-check",
      texto: `${formatNumberBR(vencidos)} recurso(s) com o prazo de resposta vencido`,
    },
    semPrazo && {
      chave: "sem-prazo",
      tom: "alerta",
      icone: "fa-circle-info",
      texto: `${formatNumberBR(semPrazo)} sem prazo no cronograma`,
    },
    pelaAbertura && {
      chave: "pela-abertura",
      icone: "fa-calendar-days",
      texto: `${formatNumberBR(pelaAbertura)} com prazo estimado (*)`,
    },
  ].filter(Boolean);
  return (
    <LinhaDoRecorte ativos={ativos}>
      {carregado ? <MarcasDoRecorte marcas={marcas} /> : null}
    </LinhaDoRecorte>
  );
}

/* ── Pendências prioritárias ────────────────────────────────────────── */

/* Severidade → tom da borda do item: alta em vermelho; média e baixa em âmbar. */
const TOM_DA_SEVERIDADE = { alta: "perigo", media: "alerta", baixa: "alerta" };

function Pendencias({ pendencias, carregado, filtros, aoFiltrar }) {
  return (
    <ListaDePendencias
      carregando={!carregado}
      vazio="Nenhuma pendência prioritária no recorte atual."
      itens={pendencias.map((p) => ({
        chave: p.chave,
        titulo: p.titulo,
        detalhe: `${formatNumberBR(p.valor)} ${p.valor === 1 ? "recurso" : "recursos"}${p.subtitulo ? ` · ${p.subtitulo}` : ""}`,
        tom: TOM_DA_SEVERIDADE[p.severidade],
        ativo: filtros.pendencia === p.chave,
        aoClicar: () => aoFiltrar("pendencia", p.chave),
      }))}
    />
  );
}

/* ── Gráficos ───────────────────────────────────────────────────────── */

/* Eixos, legenda e dica dos gráficos de barra. */
function opcoesDeBarras(
  p,
  { empilhado = false, legenda = false, deitado = false, aoClicar, dica } = {},
) {
  const categorias = {
    stacked: empilhado,
    ticks: { color: p.text, maxRotation: 0 },
    grid: { display: false },
  };
  const valores = {
    stacked: empilhado,
    beginAtZero: true,
    ticks: { color: p.text, precision: 0 },
    grid: { color: p.grid },
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 380 },
    indexAxis: deitado ? "y" : "x",
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: legenda
        ? {
            position: "top",
            labels: { color: p.text, boxWidth: 14, usePointStyle: true },
          }
        : { display: false },
      tooltip: dica ? { callbacks: dica } : {},
    },
    scales: deitado
      ? { x: valores, y: categorias }
      : { x: categorias, y: valores },
    onClick: aoClicar
      ? (_, elementos) => {
          if (elementos.length) aoClicar(elementos[0].index);
        }
      : undefined,
  };
}

const coresDaSituacao = (p) => ({
  warning: p.warn,
  success: p.ok,
  danger: p.bad,
  info: p.review,
});

/* As cores dos tokens do app (com a paleta dos painéis de reserva). */
const paleta = (escuro) => paletaDosGraficos(escuro, paletaDoPainel(escuro));

export function Graficos({
  recursos,
  pendencias,
  carregado,
  filtros,
  aoFiltrar,
  escuro,
}) {
  const analistas = useMemo(
    () => recursosPorAnalista(recursos, 12),
    [recursos],
  );
  const situacoes = useMemo(() => recursosPorSituacao(recursos), [recursos]);
  const impacto = useMemo(() => impactoNoResultado(recursos), [recursos]);
  const esteira = useMemo(() => esteiraDosRecursos(recursos), [recursos]);
  const total = recursos.length;
  const tema = escuro ? "escuro" : "claro";
  const carregando = !carregado;

  // O clique do Chart.js chega aqui, sempre com o filtro mais recente.
  const filtrar = useRef(aoFiltrar);
  useEffect(() => {
    filtrar.current = aoFiltrar;
  });

  return (
    <>
      <div className="ui-linha-de-cards">
        <CardDeGrafico
          titulo="Recursos por analista"
          altura="short"
          carregando={carregando}
        >
          <Grafico
            id="chartAnalista"
            tipo="bar"
            rotulo="Recursos por analista: em análise e decididos"
            dependencias={[analistas, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: analistas.map((a) => truncar(a.rotulo, 22)),
                  datasets: [
                    {
                      label: "Em análise",
                      data: analistas.map((a) => a.pendentes),
                      backgroundColor: p.warn,
                      borderRadius: 6,
                    },
                    {
                      label: "Decididos",
                      data: analistas.map((a) => a.concluidos),
                      backgroundColor: p.ok,
                      borderRadius: 6,
                    },
                  ],
                },
                options: opcoesDeBarras(p, {
                  empilhado: true,
                  legenda: true,
                  dica: {
                    title: (itens) =>
                      analistas[itens[0].dataIndex]?.rotulo || "",
                    afterBody: (itens) => [
                      `Total: ${formatNumberBR(analistas[itens[0].dataIndex]?.total || 0)}`,
                    ],
                  },
                  aoClicar: (indice) =>
                    analistas[indice] &&
                    filtrar.current("analista", analistas[indice].rotulo),
                }),
              };
            }}
          />
        </CardDeGrafico>
        <article className="ui-card ui-pilha">
          <h2 className="ui-titulo">Pendências prioritárias</h2>
          <Pendencias
            pendencias={pendencias}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={aoFiltrar}
          />
        </article>
      </div>

      <div className="ui-linha-de-cards">
        <CardDeGrafico titulo="Situação" altura="short" carregando={carregando}>
          <Grafico
            id="chartSituacao"
            tipo="bar"
            rotulo="Recursos por situação"
            dependencias={[situacoes, tema]}
            montar={() => {
              const p = paleta(escuro);
              const cores = coresDaSituacao(p);
              return {
                data: {
                  labels: situacoes.map((s) => s.rotulo),
                  datasets: [
                    {
                      label: "Recursos",
                      data: situacoes.map((s) => s.valor),
                      backgroundColor: situacoes.map(
                        (s) => cores[s.tom] || p.blue,
                      ),
                      borderRadius: 6,
                    },
                  ],
                },
                options: opcoesDeBarras(p, {
                  aoClicar: (indice) =>
                    situacoes[indice] &&
                    filtrar.current("situacao", situacoes[indice].id),
                }),
              };
            }}
          />
        </CardDeGrafico>
        <CardDeGrafico
          titulo="Impacto no resultado: nota atual × nota do cadastro"
          altura="short"
          carregando={carregando}
        >
          <Grafico
            id="chartImpacto"
            tipo="bar"
            rotulo="Impacto dos recursos na nota e na classificação"
            dependencias={[impacto, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: impacto.map((i) => i.rotulo),
                  datasets: [
                    {
                      label: "Recursos",
                      data: impacto.map((i) => i.valor),
                      backgroundColor: [p.review, p.warn, p.ok],
                      borderRadius: 6,
                    },
                  ],
                },
                options: opcoesDeBarras(p),
              };
            }}
          />
        </CardDeGrafico>
      </div>

      <CardDeGrafico
        elemento="section"
        titulo="Esteira do recurso"
        carregando={carregando}
      >
        <Grafico
          id="chartEsteira"
          tipo="bar"
          rotulo="Recursos por etapa da esteira"
          dependencias={[esteira, tema]}
          montar={() => {
            const p = paleta(escuro);
            return {
              data: {
                labels: esteira.map((etapa) => etapa.rotulo),
                datasets: [
                  {
                    label: "Recursos",
                    data: esteira.map((etapa) => etapa.valor),
                    backgroundColor: p.blue,
                    borderRadius: 6,
                  },
                ],
              },
              options: opcoesDeBarras(p, {
                deitado: true,
                dica: {
                  label: (item) =>
                    `${formatNumberBR(item.parsed.x)} recurso(s)${total ? ` · ${Math.round((item.parsed.x / total) * 100)}%` : ""}`,
                },
              }),
            };
          }}
        />
      </CardDeGrafico>
    </>
  );
}
