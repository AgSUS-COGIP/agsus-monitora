import { useEffect, useMemo, useRef } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  contagemPorComparecimento,
  contagemPorParecer,
  faixasDeNota,
  FILTROS_VAZIOS,
  formatarNota,
  mediaPorCriterio,
  topUnidades,
} from "../../lib/entrevistas-do-painel.js";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
import {
  Campo,
  CardDeGrafico,
  ChipDeFiltro,
  ChipsDeFiltro,
  Grafico,
  GradeDeKpis,
  Kpi,
  LinhaDoRecorte,
  ListaDePendencias,
  paletaDosGraficos,
  PainelDeFiltros,
  Segmentado,
  TopoDoPainel,
} from "../../ui/index.js";

/*
  Os blocos da tela de Entrevistas, com os componentes de src/ui/: o topo (as
  visões Resultados · Conduzir entrevistas · Roteiros num controle
  segmentado, o status discreto da carga e as ações — o título e a área estão
  no cabeçalho do app), "Refinar resultados", os KPIs em card compacto (os
  que filtram são botões), o recorte ativo, os gráficos Chart.js e as
  pendências.
*/

const truncar = (valor, limite) => {
  const texto = String(valor ?? "").trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
};

/* ── Topo ───────────────────────────────────────────────────────────── */

/* Exportar só na visão "Resultados". Sem `visoes` (sem acesso), sem o segmentado. */
export function Topo({
  visoes = null,
  visao = "resultados",
  aoTrocarVisao,
  aoExportar,
  ...props
}) {
  return (
    <TopoDoPainel
      visoes={
        visoes ? (
          <Segmentado
            tour="entrevistas-visoes"
            rotulo="Visão da tela"
            className="entrevistas-visoes"
            opcoes={visoes}
            valor={visao}
            aoMudar={aoTrocarVisao}
          />
        ) : null
      }
      aoExportar={visao === "resultados" ? aoExportar : undefined}
      {...props}
    />
  );
}

/* ── Filtros ────────────────────────────────────────────────────────── */

export const CAMPOS_DO_FILTRO = [
  ["unidade", "Unidade (DSEI)", "unidades", "Todas as unidades"],
  ["edital", "Edital", "editais", "Todos os editais"],
  ["cargo", "Cargo", "cargos", "Todos os cargos"],
  ["parecer", "Parecer", "pareceres", "Todos os pareceres"],
  ["comparecimento", "Comparecimento", "comparecimentos", "Todos"],
  ["modalidade", "Modalidade", "modalidades", "Todas as modalidades"],
  ["ligacao", "Situação da ligação", "ligacoes", "Todas as situações"],
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
  const ativos = filtrosAtivos(filtros, opcoes);

  return (
    <PainelDeFiltros
      idDoTitulo="entrevistasFiltrosTitulo"
      quantos={ativos.length}
      aoLimpar={aoLimpar}
    >
      <div className="ui-grade-de-campos" data-tour="entrevistas-filtros">
        <Campo rotulo="Buscar candidato">
          <input
            id="filtro-busca"
            type="search"
            name="busca"
            value={filtros.busca}
            disabled={!carregado}
            placeholder="Nome ou código do candidato"
            onChange={(evento) => aoMudar("busca", evento.target.value)}
          />
        </Campo>
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

export function Indicadores({
  indicadores: k,
  carregado,
  filtros,
  aoFiltrar,
  aoAbrirSemEntrevista,
}) {
  const filtro = (campo, valor) =>
    carregado
      ? {
          ativo: filtros[campo] === valor,
          aoClicar: () => aoFiltrar(campo, valor),
        }
      : {};
  const n = (valor) => formatNumberBR(valor);
  const carregando = !carregado;
  return (
    <GradeDeKpis
      tour="entrevistas-kpis"
      className="entrevistas-kpis"
      rotulo="Indicadores"
    >
      <Kpi
        cor="k-cyan"
        icone="fa-briefcase"
        chave="vagas"
        rotulo="Vagas com entrevista"
        valor={n(k.vagas)}
        carregando={carregando}
      />
      <Kpi
        cor="k-slate"
        icone="fa-users"
        chave="candidatos"
        rotulo="Candidatos"
        valor={n(k.candidatos)}
        carregando={carregando}
      />
      <Kpi
        cor="k-green"
        icone="fa-user-check"
        chave="compareceram"
        rotulo="Compareceram"
        valor={n(k.compareceram)}
        carregando={carregando}
        {...filtro("comparecimento", "S")}
      />
      <Kpi
        cor="k-green"
        icone="fa-circle-check"
        chave="aptos"
        rotulo="Aptos"
        valor={n(k.aptos)}
        carregando={carregando}
        {...filtro("parecer", "APTO")}
      />
      <Kpi
        cor="k-red"
        icone="fa-circle-xmark"
        chave="inaptos"
        rotulo="Inaptos"
        valor={n(k.inaptos)}
        carregando={carregando}
        {...filtro("parecer", "INAPTO")}
      />
      <Kpi
        cor="k-purple"
        icone="fa-chart-simple"
        chave="media"
        rotulo="Média das notas"
        valor={formatarNota(k.media)}
        carregando={carregando}
      />
      <Kpi
        cor="k-yellow"
        icone="fa-user-clock"
        chave="sem-entrevista"
        rotulo="Aprovados na análise sem entrevista"
        valor={n(k.semEntrevista)}
        titulo="Ver a lista dos aprovados sem entrevista"
        carregando={carregando}
        aoClicar={carregado ? aoAbrirSemEntrevista : undefined}
      />
    </GradeDeKpis>
  );
}

/* ── Recorte ativo ──────────────────────────────────────────────────── */

export function Recorte({ ativos }) {
  return <LinhaDoRecorte ativos={ativos} />;
}

/* ── Pendências ─────────────────────────────────────────────────────── */

/* Severidade → tom da borda do item: alta em vermelho; média e baixa em âmbar. */
const TOM_DA_SEVERIDADE = { alta: "perigo", media: "alerta", baixa: "alerta" };

function Pendencias({
  pendencias,
  carregado,
  filtros,
  aoFiltrar,
  aoAbrirSemEntrevista,
}) {
  const itens = pendencias
    .filter((p) => p.valor > 0)
    .map((p) => {
      // "Aprovados sem entrevista" abre a lista; as outras filtram a ligação.
      const abreLista = p.chave === "sem_entrevista";
      return {
        chave: p.chave,
        titulo: p.titulo,
        detalhe: `${formatNumberBR(p.valor)} ${p.valor === 1 ? p.unidade[0] : p.unidade[1]} · ${p.subtitulo}`,
        tom: TOM_DA_SEVERIDADE[p.severidade],
        ativo: abreLista ? undefined : filtros.ligacao === p.chave,
        aoClicar: abreLista
          ? aoAbrirSemEntrevista
          : () => aoFiltrar("ligacao", p.chave),
      };
    });
  return (
    <ListaDePendencias
      itens={itens}
      carregando={!carregado}
      vazio="Nenhuma pendência no recorte atual."
    />
  );
}

/* ── Gráficos ───────────────────────────────────────────────────────── */

function opcoesDeBarras(
  p,
  { deitado = false, aoClicar, dica, maximo, decimais = false } = {},
) {
  const categorias = {
    ticks: { color: p.text, maxRotation: 0, autoSkip: false },
    grid: { display: false },
  };
  const valores = {
    beginAtZero: true,
    ...(maximo ? { suggestedMax: maximo } : {}),
    ticks: { color: p.text, ...(decimais ? {} : { precision: 0 }) },
    grid: { color: p.grid },
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 380 },
    indexAxis: deitado ? "y" : "x",
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
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

function opcoesDeRosca(p, { aoClicar } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 380 },
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: p.text, boxWidth: 14, usePointStyle: true },
      },
    },
    onClick: aoClicar
      ? (_, elementos) => {
          if (elementos.length) aoClicar(elementos[0].index);
        }
      : undefined,
  };
}

/* As cores dos tokens do app (com a paleta dos painéis de reserva). */
const paleta = (escuro) => paletaDosGraficos(escuro, paletaDoPainel(escuro));

export function Graficos({
  entrevistas,
  criterios,
  pendencias,
  carregado,
  filtros,
  aoFiltrar,
  aoAbrirSemEntrevista,
  escuro,
}) {
  const pareceres = useMemo(
    () => contagemPorParecer(entrevistas),
    [entrevistas],
  );
  const comparecimentos = useMemo(
    () => contagemPorComparecimento(entrevistas),
    [entrevistas],
  );
  const faixas = useMemo(() => faixasDeNota(entrevistas), [entrevistas]);
  const porCriterio = useMemo(
    () => mediaPorCriterio(entrevistas, criterios),
    [entrevistas, criterios],
  );
  const unidades = useMemo(() => topUnidades(entrevistas, 10), [entrevistas]);
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
          titulo="Aptos x Inaptos"
          altura="short"
          carregando={carregando}
        >
          <Grafico
            id="chartParecer"
            tipo="doughnut"
            rotulo="Entrevistas por parecer: aptos, inaptos e sem parecer"
            dependencias={[pareceres, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: pareceres.map((x) => x.rotulo),
                  datasets: [
                    {
                      data: pareceres.map((x) => x.valor),
                      backgroundColor: [p.ok, p.bad, p.neutro],
                      borderColor: p.surface,
                      borderWidth: 2,
                    },
                  ],
                },
                options: opcoesDeRosca(p, {
                  aoClicar: (indice) =>
                    pareceres[indice] &&
                    filtrar.current("parecer", pareceres[indice].id),
                }),
              };
            }}
          />
        </CardDeGrafico>
        <CardDeGrafico
          titulo="Comparecimento"
          altura="short"
          carregando={carregando}
        >
          <Grafico
            id="chartComparecimento"
            tipo="doughnut"
            rotulo="Entrevistas por comparecimento"
            dependencias={[comparecimentos, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: comparecimentos.map((x) => x.rotulo),
                  datasets: [
                    {
                      data: comparecimentos.map((x) => x.valor),
                      backgroundColor: [p.review, p.warn, p.neutro],
                      borderColor: p.surface,
                      borderWidth: 2,
                    },
                  ],
                },
                options: opcoesDeRosca(p, {
                  aoClicar: (indice) =>
                    comparecimentos[indice] &&
                    filtrar.current(
                      "comparecimento",
                      comparecimentos[indice].id,
                    ),
                }),
              };
            }}
          />
        </CardDeGrafico>
      </div>

      <div className="ui-linha-de-cards">
        <CardDeGrafico
          titulo="Faixas de nota final (0 a 20, presentes)"
          altura="short"
          carregando={carregando}
        >
          <Grafico
            id="chartFaixas"
            tipo="bar"
            rotulo="Candidatos que compareceram por faixa de nota final"
            dependencias={[faixas, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: faixas.map((f) => f.rotulo),
                  datasets: [
                    {
                      label: "Candidatos",
                      data: faixas.map((f) => f.valor),
                      backgroundColor: [p.bad, p.warn, p.review, p.ok],
                      borderRadius: 6,
                    },
                  ],
                },
                options: opcoesDeBarras(p),
              };
            }}
          />
        </CardDeGrafico>
        <article
          className="ui-card entrevistas-bloco-de-pendencias"
          data-tour="entrevistas-pendencias"
        >
          <h2 className="ui-titulo">Pendências</h2>
          <Pendencias
            pendencias={pendencias}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={aoFiltrar}
            aoAbrirSemEntrevista={aoAbrirSemEntrevista}
          />
        </article>
      </div>

      <div className="ui-linha-de-cards">
        <CardDeGrafico
          titulo="Média por critério (0 a 5)"
          altura="short"
          carregando={carregando}
        >
          <Grafico
            id="chartCriterios"
            tipo="bar"
            rotulo="Média das notas por critério da entrevista"
            dependencias={[porCriterio, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: porCriterio.map((c) => truncar(c.rotulo, 26)),
                  datasets: [
                    {
                      label: "Média",
                      data: porCriterio.map((c) =>
                        c.media === null ? 0 : Number(c.media.toFixed(2)),
                      ),
                      backgroundColor: p.blue,
                      borderRadius: 6,
                    },
                  ],
                },
                options: opcoesDeBarras(p, {
                  deitado: true,
                  maximo: 5,
                  decimais: true,
                  dica: {
                    title: (itens) =>
                      porCriterio[itens[0].dataIndex]?.texto || "",
                    label: (item) =>
                      `Média ${formatarNota(item.parsed.x)} · ${formatNumberBR(porCriterio[item.dataIndex]?.quantidade || 0)} nota(s)`,
                  },
                }),
              };
            }}
          />
        </CardDeGrafico>
        <CardDeGrafico
          titulo="Top unidades por entrevistados"
          altura="short"
          carregando={carregando}
        >
          <Grafico
            id="chartUnidades"
            tipo="bar"
            rotulo="Unidades com mais entrevistados"
            dependencias={[unidades, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: unidades.map((u) => truncar(u.rotulo, 24)),
                  datasets: [
                    {
                      label: "Entrevistados",
                      data: unidades.map((u) => u.valor),
                      backgroundColor: p.review,
                      borderRadius: 6,
                    },
                  ],
                },
                options: opcoesDeBarras(p, {
                  deitado: true,
                  dica: {
                    title: (itens) =>
                      unidades[itens[0].dataIndex]?.rotulo || "",
                  },
                  aoClicar: (indice) =>
                    unidades[indice] &&
                    unidades[indice].rotulo !== "Sem unidade" &&
                    filtrar.current("unidade", unidades[indice].rotulo),
                }),
              };
            }}
          />
        </CardDeGrafico>
      </div>
    </>
  );
}
