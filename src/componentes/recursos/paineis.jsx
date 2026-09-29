import { useMemo } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  esteiraDosRecursos,
  FILTROS_VAZIOS,
  impactoNoResultado,
  recursosPorAnalista,
  recursosPorSituacao,
} from "../../lib/recursos-dos-candidatos.js";

/*
  Os blocos de cima da aba Recursos, na ordem do painel de análises: "Refinar
  resultados", os indicadores e os gráficos (recursos por analista, pendências
  prioritárias, situação, impacto e esteira). Os gráficos são barras em HTML:
  leem no tema escuro pelos tokens e têm o número escrito ao lado — o texto é a
  alternativa em tabela que o DESIGN.md pede.
*/

export const classes = (...lista) => lista.filter(Boolean).join(" ");

const Esqueleto = ({ className = "" }) => (
  <span className={classes("esqueleto", className)} aria-hidden="true" />
);

const CAMPOS_DO_FILTRO = [
  ["edital", "Edital", "editais", "Todos os editais"],
  ["origem", "Origem", "origens", "Todas as origens"],
  ["analista", "Analista", "analistas", "Todos os analistas"],
  ["situacao", "Situação", "situacoes", "Todas as situações"],
  ["pendencia", "Pendência", "pendencias", "Qualquer pendência"],
];

export function Filtros({ filtros, opcoes, carregado, aoMudar, aoLimpar }) {
  const ativos = CAMPOS_DO_FILTRO.filter(([campo]) => filtros[campo]);
  const algum = ativos.length > 0 || Boolean(filtros.busca);
  return (
    <section
      className="card recursos-filtros"
      aria-labelledby="recursosFiltrosTitulo"
    >
      <div className="recursos-filtros-topo">
        <div>
          <span className="recursos-sobretitulo">Filtros</span>
          <h3 id="recursosFiltrosTitulo" className="recursos-titulo">
            Refinar resultados
          </h3>
          <p className="recursos-dica">
            Os filtros valem para os indicadores, os gráficos, a tabela e o CSV.
          </p>
        </div>
        <button
          type="button"
          className="btn secondary"
          disabled={!algum}
          onClick={aoLimpar}
        >
          <i className="fa-solid fa-eraser" aria-hidden="true" /> Limpar
        </button>
      </div>
      <div className="recursos-filtros-grade">
        {CAMPOS_DO_FILTRO.map(([campo, rotulo, lista, todos]) => (
          <label key={campo} className="recursos-campo">
            <span>{rotulo}</span>
            <select
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
          </label>
        ))}
        <label className="recursos-campo recursos-campo--busca">
          <span>Buscar</span>
          <input
            type="search"
            name="busca"
            value={filtros.busca}
            disabled={!carregado}
            placeholder="Candidato, código, vaga, nº ou processo SEI"
            onChange={(evento) => aoMudar("busca", evento.target.value)}
          />
        </label>
      </div>
      {ativos.length ? (
        <div className="recursos-chips" aria-label="Filtros aplicados">
          {ativos.map(([campo, rotulo, lista]) => (
            <button
              key={campo}
              type="button"
              className="recursos-chip"
              onClick={() => aoMudar(campo, FILTROS_VAZIOS[campo])}
              aria-label={`Tirar o filtro ${rotulo}`}
            >
              <b>{rotulo}:</b>{" "}
              {opcoes[lista].find((o) => o.valor === filtros[campo])?.rotulo ||
                filtros[campo]}
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* Indicador da fileira: card compacto, linha de 3px e número na cor do estado. */
function Kpi({
  tom = "info",
  icone,
  rotulo,
  valor,
  carregado,
  filtro,
  ativo,
  aoFiltrar,
  sufixo = "",
}) {
  const conteudo = (
    <>
      <span className="recursos-kpi-icone">
        <i className={`fa-solid ${icone}`} aria-hidden="true" />
      </span>
      <span className="recursos-kpi-rotulo">{rotulo}</span>
      <strong aria-busy={carregado ? undefined : true}>
        {carregado ? (
          `${formatNumberBR(valor)}${sufixo}`
        ) : (
          <Esqueleto className="esqueleto--numero" />
        )}
      </strong>
    </>
  );
  if (!filtro)
    return (
      <div className="recursos-kpi" data-tone={tom}>
        {conteudo}
      </div>
    );
  return (
    <button
      type="button"
      className={classes(
        "recursos-kpi",
        "recursos-kpi--filtro",
        ativo && "is-ativo",
      )}
      data-tone={tom}
      aria-pressed={ativo}
      disabled={!carregado}
      title="Filtrar a tabela"
      onClick={aoFiltrar}
    >
      {conteudo}
    </button>
  );
}

export function Indicadores({ indicadores: k, carregado, filtros, aoFiltrar }) {
  const filtro = (campo, valor) => ({
    filtro: true,
    ativo: filtros[campo] === valor,
    aoFiltrar: () => aoFiltrar(campo, valor),
  });
  return (
    <section className="recursos-kpis" aria-label="Indicadores dos recursos">
      <Kpi
        icone="fa-scale-balanced"
        rotulo="Total de recursos"
        valor={k.total}
        carregado={carregado}
      />
      <Kpi
        tom="warning"
        icone="fa-clock"
        rotulo="Em análise"
        valor={k.pendentes}
        carregado={carregado}
        {...filtro("situacao", "EM_ANALISE")}
      />
      <Kpi
        tom="success"
        icone="fa-circle-check"
        rotulo="Decididos"
        valor={k.concluidos}
        carregado={carregado}
      />
      <Kpi
        tom={k.atrasados ? "danger" : "success"}
        icone="fa-calendar-xmark"
        rotulo="Prazo vencido"
        valor={k.atrasados}
        carregado={carregado}
        {...filtro("pendencia", "prazo_vencido")}
      />
      <Kpi
        tom="danger"
        icone="fa-folder-open"
        rotulo="Sem processo SEI"
        valor={k.semSei}
        carregado={carregado}
        {...filtro("pendencia", "sem_sei")}
      />
      <Kpi
        tom="warning"
        icone="fa-paper-plane"
        rotulo="Sem resposta enviada"
        valor={k.semResposta}
        carregado={carregado}
      />
      <Kpi
        tom="info"
        icone="fa-right-left"
        rotulo="Mudou nota ou classificação"
        valor={k.mudouResultado}
        carregado={carregado}
        {...filtro("pendencia", "mudou_resultado")}
      />
      <Kpi
        tom="neutral"
        icone="fa-chart-simple"
        rotulo="Taxa de conclusão"
        valor={k.taxaConclusao}
        sufixo="%"
        carregado={carregado}
      />
    </section>
  );
}

/* Barra horizontal com o número escrito; `partes` empilha (soma = total). */
function Barra({ rotulo, partes, maximo, total, ativo, aoClicar, sufixo }) {
  const largura = (valor) =>
    `${maximo ? Math.max((valor / maximo) * 100, valor ? 2 : 0) : 0}%`;
  const corpo = (
    <>
      <span className="recursos-barra-rotulo" title={rotulo}>
        {rotulo}
      </span>
      <span className="recursos-barra-trilho" aria-hidden="true">
        {partes.map((parte) => (
          <span
            key={parte.id}
            className="recursos-barra-parte"
            data-tone={parte.tom}
            style={{ width: largura(parte.valor) }}
          />
        ))}
      </span>
      <span className="recursos-barra-valor">
        {formatNumberBR(total)}
        {sufixo ? <small>{sufixo}</small> : null}
      </span>
    </>
  );
  if (!aoClicar) return <li className="recursos-barra-item">{corpo}</li>;
  return (
    <li>
      <button
        type="button"
        className={classes(
          "recursos-barra-item",
          "recursos-barra-item--filtro",
          ativo && "is-ativo",
        )}
        aria-pressed={ativo}
        onClick={aoClicar}
      >
        {corpo}
      </button>
    </li>
  );
}

function BlocoDoGrafico({
  id,
  sobretitulo,
  titulo,
  dica,
  carregado,
  vazio,
  children,
  legenda,
}) {
  return (
    <article className="card recursos-bloco" aria-labelledby={id}>
      <span className="recursos-sobretitulo">{sobretitulo}</span>
      <h3 id={id} className="recursos-titulo">
        {titulo}
      </h3>
      {dica ? <p className="recursos-dica">{dica}</p> : null}
      {legenda}
      {!carregado ? (
        <div className="recursos-grafico-esqueleto" aria-hidden="true">
          {[80, 62, 48, 30].map((largura) => (
            <Esqueleto key={largura} className="esqueleto--linha" />
          ))}
        </div>
      ) : vazio ? (
        <p className="recursos-vazio">{vazio}</p>
      ) : (
        children
      )}
    </article>
  );
}

const Legenda = ({ itens }) => (
  <ul className="recursos-legenda">
    {itens.map((item) => (
      <li key={item.rotulo}>
        <span
          className="recursos-legenda-cor"
          data-tone={item.tom}
          aria-hidden="true"
        />
        {item.rotulo}
      </li>
    ))}
  </ul>
);

const SEVERIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" };

export function Graficos({
  recursos,
  pendencias,
  carregado,
  filtros,
  aoFiltrar,
}) {
  const analistas = useMemo(() => recursosPorAnalista(recursos), [recursos]);
  const situacoes = useMemo(() => recursosPorSituacao(recursos), [recursos]);
  const impacto = useMemo(() => impactoNoResultado(recursos), [recursos]);
  const esteira = useMemo(() => esteiraDosRecursos(recursos), [recursos]);
  const maxAnalista = Math.max(0, ...analistas.map((a) => a.total));
  const maxSituacao = Math.max(0, ...situacoes.map((s) => s.valor));
  const maxImpacto = Math.max(0, ...impacto.map((i) => i.valor));
  const total = recursos.length;
  const semRecursos = "Nenhum recurso no recorte.";

  return (
    <>
      <section className="recursos-grade-operacional">
        <BlocoDoGrafico
          id="recursosPorAnalista"
          sobretitulo="Carga operacional"
          titulo="Recursos por analista"
          dica="Clique em um analista para recortar a fila."
          carregado={carregado}
          vazio={analistas.length ? "" : semRecursos}
          legenda={
            <Legenda
              itens={[
                { rotulo: "Em análise", tom: "warning" },
                { rotulo: "Decididos", tom: "success" },
              ]}
            />
          }
        >
          <ul className="recursos-barras">
            {analistas.map((a) => (
              <Barra
                key={a.rotulo}
                rotulo={a.rotulo}
                total={a.total}
                maximo={maxAnalista}
                partes={[
                  { id: "pendentes", tom: "warning", valor: a.pendentes },
                  { id: "concluidos", tom: "success", valor: a.concluidos },
                ]}
                ativo={filtros.analista === a.rotulo}
                aoClicar={() => aoFiltrar("analista", a.rotulo)}
              />
            ))}
          </ul>
        </BlocoDoGrafico>
        <BlocoDoGrafico
          id="recursosPendencias"
          sobretitulo="Ação imediata"
          titulo="Pendências prioritárias"
          dica="Clique em um item para recortar a fila."
          carregado={carregado}
          vazio={pendencias.length ? "" : "Nenhuma pendência no recorte."}
        >
          <ul className="recursos-pendencias">
            {pendencias.map((p) => (
              <li key={p.chave}>
                <button
                  type="button"
                  className={classes(
                    "recursos-pendencia",
                    filtros.pendencia === p.chave && "is-ativo",
                  )}
                  data-severidade={p.severidade}
                  aria-pressed={filtros.pendencia === p.chave}
                  onClick={() => aoFiltrar("pendencia", p.chave)}
                >
                  <span className="recursos-pendencia-topo">
                    <b>{p.titulo}</b>
                    <span className="recursos-severidade">
                      {SEVERIDADE[p.severidade]}
                    </span>
                  </span>
                  <small>
                    {formatNumberBR(p.valor)}{" "}
                    {p.valor === 1 ? "recurso" : "recursos"} · {p.subtitulo}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </BlocoDoGrafico>
      </section>
      <section className="recursos-grade-tripla">
        <BlocoDoGrafico
          id="recursosSituacao"
          sobretitulo="Decisão"
          titulo="Situação"
          carregado={carregado}
          vazio={total ? "" : semRecursos}
        >
          <ul className="recursos-barras">
            {situacoes.map((s) => (
              <Barra
                key={s.id}
                rotulo={s.rotulo}
                total={s.valor}
                maximo={maxSituacao}
                partes={[{ id: s.id, tom: s.tom, valor: s.valor }]}
                ativo={filtros.situacao === s.id}
                aoClicar={() => aoFiltrar("situacao", s.id)}
              />
            ))}
          </ul>
        </BlocoDoGrafico>
        <BlocoDoGrafico
          id="recursosImpacto"
          sobretitulo="Resultado"
          titulo="Impacto no resultado"
          dica="A nota mudou quando a nota atual da análise difere da do cadastro."
          carregado={carregado}
          vazio={total ? "" : semRecursos}
        >
          <ul className="recursos-barras">
            {impacto.map((i, indice) => (
              <Barra
                key={i.id}
                rotulo={i.rotulo}
                total={i.valor}
                maximo={maxImpacto}
                partes={[
                  { id: i.id, tom: `serie-${indice + 1}`, valor: i.valor },
                ]}
              />
            ))}
          </ul>
        </BlocoDoGrafico>
        <BlocoDoGrafico
          id="recursosEsteira"
          sobretitulo="Fluxo"
          titulo="Esteira do recurso"
          dica="Quantos recursos já passaram por cada etapa."
          carregado={carregado}
          vazio={total ? "" : semRecursos}
        >
          <ul className="recursos-barras">
            {esteira.map((etapa) => (
              <Barra
                key={etapa.id}
                rotulo={etapa.rotulo}
                total={etapa.valor}
                maximo={total}
                partes={[{ id: etapa.id, tom: "serie-1", valor: etapa.valor }]}
                sufixo={
                  total ? ` ${Math.round((etapa.valor / total) * 100)}%` : ""
                }
              />
            ))}
          </ul>
        </BlocoDoGrafico>
      </section>
    </>
  );
}
