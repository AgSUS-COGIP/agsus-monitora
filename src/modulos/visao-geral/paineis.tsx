import type {
  CampoDoFiltro,
  PropsDoPainel,
  PropsComTextos,
  PropsDoBloco,
  SnapshotDaVisaoGeral,
} from "./tipos.ts";
import type { Perfil } from "./tipos.ts";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.tsx";
import {
  anoDaSelecao,
  anosDosEditais,
  editaisDoAno,
} from "../../lib/atalhos-de-filtro.ts";
import {
  editaisComEtapaNaSemana,
  primeiroNome,
  resumoDoDia,
  saudacao,
} from "../../lib/boas-vindas.ts";
import { formatNumberBR } from "../../lib/formatters";
import {
  andamentoPorFase,
  CAMPOS_DO_FILTRO,
  posResultado,
  processosPorProjeto,
  rotuloDoAtalho,
} from "../../lib/visao-geral.ts";
import {
  ChipDeFiltro,
  ChipsDeFiltro,
  ErroAoCarregar,
  EstadoVazio,
  ListaDePendencias,
  MaisOpcoes,
  PainelDeFiltros,
} from "../../ui/index.ts";
import { useState } from "react";

/*
  Os blocos da Visão geral no "painel de decisão" (layout A, escolhido em
  17/11/2026 entre três prévias):

  - Cabeçalho: a saudação e os editais com etapa na semana à esquerda; a hora
    da carga, "Filtros (n)", Atualizar e Exportar à direita. Substituiu três
    faixas (o card de boas-vindas, o topo e o card "Filtros" quase vazio).
  - Filtros: o painel só aparece quando aberto pelo botão; os chips do
    recorte ficam sempre à vista, com "Limpar tudo".
  - Vagas: as vagas imediatas e as três parcelas delas (contratadas, em
    seleção, ociosas) com a barra da divisão; cadastro reserva e inscritos
    numa linha embaixo. Esperam o acompanhamento (`aguardandoVagas`) para não
    mostrar um número que muda segundos depois.
  - Pede ação: os críticos e as pendências do pós-resultado, numa lista só.
  - Em andamento: as fases só dos editais abertos, sem as vazias.
  - "Processos por projeto" (só Projetos), como antes.
*/

const fmt = (valor: number) => formatNumberBR(valor);
const plural = (n: number, um: string, varios: string) =>
  `${fmt(n)} ${n === 1 ? um : varios}`;
const parte = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0;

/* ── Cabeçalho ──────────────────────────────────────────────────────── */

const horaCurta = (tempo: number) =>
  new Date(tempo).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

/* Abre o Cronograma da área pelo item do menu (troca a área e a tela). */
function abrirCronogramaDaArea(area: string) {
  document
    .querySelector<HTMLElement>(
      `.menu-item[data-view="calendario"][data-area="${area}"]`,
    )
    ?.click();
}

/** Quantos filtros recortam a página (campos, busca, DSEI e atalho). */
export const quantosFiltros = (e: SnapshotDaVisaoGeral) =>
  e.quantosFiltros +
  (e.busca.trim() ? 1 : 0) +
  (e.dsei.chave ? 1 : 0) +
  (e.atalho ? 1 : 0);

export function Cabecalho({
  e,
  perfil,
  agora,
  filtrosAbertos,
  aoAlternarFiltros,
  aoExportar,
}: {
  e: SnapshotDaVisaoGeral;
  perfil: Perfil | null;
  agora: () => Date;
  filtrosAbertos: boolean;
  aoAlternarFiltros: () => void;
  aoExportar: () => void;
}) {
  const status =
    e.erro && !e.carregado
      ? ""
      : !e.carregado
        ? "Carregando dados…"
        : e.carregadoEm
          ? `Atualizado às ${horaCurta(e.carregadoEm)}`
          : "";
  const nome = perfil
    ? primeiroNome(perfil.nome || perfil.email?.split("@")[0])
    : "";
  const titulo = perfil
    ? [saudacao(agora().getHours()), nome].filter(Boolean).join(", ")
    : "";
  const semana = e.carregado
    ? editaisComEtapaNaSemana(e.linhasDaArea, agora())
    : 0;
  const quantos = quantosFiltros(e);
  return (
    <header className="visao-geral-cabecalho">
      <div
        className="visao-geral-saudacao"
        role="status"
        aria-live="polite"
        data-tour="visao-geral-boas-vindas"
      >
        {titulo ? (
          <h2 className="visao-geral-saudacao-titulo">{titulo}</h2>
        ) : null}
        {e.carregado ? (
          <p className="visao-geral-saudacao-semana">
            {resumoDoDia(semana)}
            {semana ? (
              <>
                {" "}
                <button
                  type="button"
                  className="visao-geral-link"
                  data-tour="visao-geral-ver-cronograma"
                  onClick={() => abrirCronogramaDaArea(e.area)}
                >
                  Ver cronograma
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="ui-topo-acoes visao-geral-acoes">
        <span className="status-discreto" data-status-da-carga="">
          {status}
        </span>
        <button
          type="button"
          className="btn secondary"
          aria-expanded={filtrosAbertos}
          aria-controls="visaoGeralFiltros"
          data-tour="visao-geral-filtros"
          onClick={aoAlternarFiltros}
        >
          <i className="fa-solid fa-filter" aria-hidden="true" /> Filtros
          {quantos ? ` (${fmt(quantos)})` : ""}
        </button>
        <button
          type="button"
          className="btn secondary"
          data-acao="atualizar"
          onClick={() => void window.refreshData?.()}
        >
          <i className="fa-solid fa-rotate" aria-hidden="true" /> Atualizar
        </button>
        <button
          type="button"
          className="btn secondary"
          data-acao="exportar"
          disabled={!e.carregado || !e.filtradas.length}
          onClick={aoExportar}
        >
          <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
        </button>
      </div>
    </header>
  );
}

/* ── Filtros ────────────────────────────────────────────────────────── */

function CampoDoFiltro({
  campo,
  rotulo,
  todos,
  e,
  estado,
}: PropsDoPainel & { campo: CampoDoFiltro; rotulo: string; todos: string }) {
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
function CampoDoAno({ e, estado }: PropsDoPainel) {
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

const resumoDosValores = (valores: readonly string[]) =>
  valores.length > 2 ? `${valores.length} selecionados` : valores.join(", ");

/*
  O painel dos campos abre pelo botão "Filtros" do cabeçalho; os chips do
  recorte ficam à vista mesmo com ele fechado (`.visao-geral-filtros`, que a
  Aya lê para saber o recorte).
*/
export function Filtros({
  e,
  estado,
  textos,
  aberto,
}: PropsComTextos & { aberto: boolean }) {
  const extras = CAMPOS_DO_FILTRO.filter((c) => c.mais);
  const extrasAtivos = extras.filter((c) => e.filtros[c.campo].length).length;
  const [maisAberto, setMaisAberto] = useState(extrasAtivos > 0);
  const quantos = quantosFiltros(e);
  if (!aberto && !quantos) return null;
  return (
    <div className="visao-geral-filtros">
      {aberto ? (
        <div id="visaoGeralFiltros">
          <PainelDeFiltros
            idDoTitulo="visaoGeralFiltrosTitulo"
            recolhivel={false}
            titulo={textos.filtros}
            subtitulo={textos.filtrosSubtitulo}
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
              aoAlternar={() => setMaisAberto((valor) => !valor)}
              quantos={extrasAtivos}
              titulo="Mostrar Fase e UF"
            >
              {extras.map((c) => (
                <CampoDoFiltro key={c.campo} {...c} e={e} estado={estado} />
              ))}
            </MaisOpcoes>
          </PainelDeFiltros>
        </div>
      ) : null}
      {quantos ? (
        <div className="visao-geral-recorte">
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
          <button
            type="button"
            className="btn ghost small"
            onClick={estado.limparTudo}
          >
            Limpar tudo
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ── Vagas ──────────────────────────────────────────────────────────── */

/* De onde vem o desconto das vagas imediatas (src/lib/vagas-reabertas.ts). */
const TITULO_DAS_REABERTAS =
  "Cada vaga conta uma vez: a vaga sem contratação reaberta em edital mais novo da mesma unidade, para o mesmo cargo, conta só no edital novo.";

function Numero({
  chave,
  rotulo,
  valor,
  detalhe,
  titulo,
  tom,
  esperando,
}: {
  chave: string;
  rotulo: string;
  valor: number;
  detalhe?: string;
  titulo?: string;
  tom?: string;
  esperando: boolean;
}) {
  return (
    <div
      className="visao-geral-numero"
      data-kpi={chave}
      data-tom={tom}
      aria-busy={esperando || undefined}
      title={titulo}
    >
      <span className="visao-geral-numero-rotulo">{rotulo}</span>
      {esperando ? (
        <span className="ui-kpi-valor ui-esqueleto" aria-hidden="true" />
      ) : (
        <span className="ui-kpi-valor">{fmt(valor)}</span>
      )}
      {detalhe && !esperando ? (
        <span className="visao-geral-numero-detalhe">{detalhe}</span>
      ) : null}
    </div>
  );
}

export function Vagas({ e, textos }: Omit<PropsComTextos, "estado">) {
  const k = e.indicadores;
  const esperando = !e.carregado || e.aguardandoVagas;
  const rotulo = textos.rotulos;
  const daVaga = (n: number) => `${parte(n, k.vagas)}% das vagas`;
  return (
    <section
      className="ui-card visao-geral-kpis visao-geral-vagas"
      aria-label={textos.indicadores}
      data-tour="visao-geral-kpis"
    >
      <div className="visao-geral-vagas-numeros">
        <Numero
          chave="vagas"
          rotulo={rotulo.kpi_vagas_label}
          valor={k.vagas}
          esperando={esperando}
          {...(k.reabertas > 0
            ? {
                detalhe: `sem ${fmt(k.reabertas)} reabertas`,
                titulo: TITULO_DAS_REABERTAS,
              }
            : {})}
        />
        <Numero
          chave="contratadas"
          tom="sucesso"
          rotulo={rotulo.kpi_contratadas_label}
          valor={k.contratadas}
          detalhe={daVaga(k.contratadas)}
          esperando={esperando}
        />
        <Numero
          chave="emSelecao"
          tom="info"
          rotulo={rotulo.kpi_em_selecao_label}
          valor={k.emSelecao}
          detalhe={daVaga(k.emSelecao)}
          esperando={esperando}
        />
        <Numero
          chave="ociosas"
          tom="alerta"
          rotulo={rotulo.kpi_ociosas_label}
          valor={k.ociosas}
          detalhe={daVaga(k.ociosas)}
          esperando={esperando}
        />
      </div>
      {!esperando && k.vagas > 0 ? (
        <div
          className="visao-geral-divisao"
          role="img"
          aria-label={`Das ${fmt(k.vagas)} vagas: ${fmt(k.contratadas)} contratadas, ${fmt(k.emSelecao)} em seleção e ${fmt(k.ociosas)} ociosas`}
        >
          {(
            [
              ["sucesso", k.contratadas],
              ["info", k.emSelecao],
              ["alerta", k.ociosas],
            ] as const
          )
            .filter(([, n]) => n > 0)
            .map(([tom, n]) => (
              <i key={tom} data-tom={tom} style={{ flexGrow: n }} />
            ))}
        </div>
      ) : (
        <div className="visao-geral-divisao is-vazia" aria-hidden="true" />
      )}
      <div className="visao-geral-vagas-outros">
        <Numero
          chave="cadastroReserva"
          rotulo={rotulo.kpi_cadastro_reserva_label}
          valor={k.cadastroReserva}
          esperando={!e.carregado}
        />
        <Numero
          chave="inscritos"
          rotulo={rotulo.kpi_inscritos_label}
          valor={k.inscritos}
          esperando={!e.carregado}
        />
      </div>
    </section>
  );
}

/* ── Bloco com título e lista ───────────────────────────────────────── */

function Bloco({ id, titulo, className, children }: PropsDoBloco) {
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

/* ── Pede ação: críticos e pós-resultado ────────────────────────────── */

export function PedeAcao({ e, estado, textos }: PropsComTextos) {
  const criticos = e.indicadores.criticos;
  const pendencias = posResultado(e.filtradas, { comListas: e.comListas })
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
  const itens = [
    ...(criticos || e.criticosAtivo
      ? [
          {
            chave: "criticos",
            titulo: textos.rotulos.kpi_criticos_label,
            detalhe: plural(criticos, "edital", "editais"),
            tom: "perigo",
            ativo: e.criticosAtivo,
            aoClicar: estado.alternarCriticos,
          },
        ]
      : []),
    ...pendencias,
  ];
  return (
    <Bloco
      id="visaoGeralPedeAcaoTitulo"
      titulo="Pede ação"
      className="visao-geral-pede-acao"
    >
      {e.erro && !e.carregado ? (
        <ErroAoCarregar oQue="as pendências" />
      ) : (
        <ListaDePendencias
          itens={itens}
          carregando={!e.carregado}
          vazio="Nenhuma pendência."
        />
      )}
    </Bloco>
  );
}

/* ── Em andamento, por fase ─────────────────────────────────────────── */

export function EmAndamento({ e, estado }: PropsDoPainel) {
  const { emAndamento, concluidos, cancelados } = andamentoPorFase(e.filtradas);
  const filtrada = e.filtros.fase.length === 1 ? e.filtros.fase[0] : null;
  const encerrados = [
    concluidos ? plural(concluidos, "concluído", "concluídos") : "",
    cancelados ? plural(cancelados, "cancelado", "cancelados") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Bloco
      id="visaoGeralFasesTitulo"
      titulo="Em andamento, por fase"
      className="visao-geral-fases"
    >
      {e.erro && !e.carregado ? (
        <ErroAoCarregar oQue="as fases" />
      ) : !e.carregado ? (
        <div className="ui-esqueleto ui-esqueleto-linha" aria-hidden="true" />
      ) : (
        <>
          {emAndamento.length ? (
            <div className="visao-geral-fases-chips">
              {emAndamento.map(({ fase, quantos, tom }) => (
                <button
                  key={fase}
                  type="button"
                  className="visao-geral-fase"
                  data-tom={tom}
                  data-fase={fase}
                  aria-pressed={filtrada === fase}
                  title={`Filtrar pela fase ${fase}`}
                  onClick={() =>
                    estado.alternarFiltroUnico("fase", fase, "Filtro de fase")
                  }
                >
                  {fase} <b>{fmt(quantos)}</b>
                </button>
              ))}
            </div>
          ) : (
            <EstadoVazio>Nenhum edital em andamento.</EstadoVazio>
          )}
          {encerrados ? (
            <p className="visao-geral-encerrados">{encerrados}</p>
          ) : null}
        </>
      )}
    </Bloco>
  );
}

/* ── Processos por projeto (Projetos) ───────────────────────────────── */

export function ProcessosPorProjeto({ e, estado }: PropsDoPainel) {
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
