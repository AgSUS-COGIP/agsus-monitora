import { useEffect, useMemo, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  ETAPAS,
  FILTROS_VAZIOS,
  filtrarRecursos,
  rotuloDaOrigem,
  rotuloDaSituacao,
  tomDaSituacao,
} from "../../lib/recursos-dos-candidatos.js";
import { rotuloDoEstado, tomDoEstado } from "../../lib/resposta-do-recurso.js";
import { classes } from "./paineis.jsx";

/*
  "Fila de recursos": a tabela do painel, com a marcação da "Fila operacional
  consolidada" do painel de análises (`.table-card` > `.table-head`,
  `.table-meta`, `.table-wrap` com `tbody#tableBody`) e o carregamento
  contínuo dele: 50 linhas por vez, e mais 50 quando a rolagem da fila chega
  perto do fim (a faixa `.analises-infinite-status` diz quanto falta). A busca
  do cabeçalho vale só para a fila, como lá. Clique na linha (ou Enter) ou em
  "Detalhes" abre a gaveta.
*/

const POR_VEZ = 50;
const PERTO_DO_FIM_PX = 160;
const LINHAS_DO_ESQUELETO = 8;
const COLUNAS = [
  ["Nº", "6%"],
  ["Candidato", "19%"],
  ["Edital", "13%"],
  ["Origem", "10%"],
  ["Analista", "11%"],
  ["Situação", "10%"],
  ["Etapas", "8%"],
  ["Prazo", "11%"],
  ["Aberto há", "6%"],
  ["Ações", "8%"],
];

export function dataBR(valor) {
  const texto = String(valor ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? texto.split("-").reverse().join("/")
    : "";
}

/* O tom da situação no `.badge` do painel de análises. */
const BADGE_DO_TOM = {
  warning: "pendente",
  success: "aprovado",
  danger: "reprovado",
  info: "revisar",
};

export function SeloDaSituacao({ situacao }) {
  return (
    <span
      className={`badge ${BADGE_DO_TOM[tomDaSituacao(situacao)] || "neutro"}`}
    >
      {rotuloDaSituacao(situacao)}
    </span>
  );
}

/* O estado da resposta escrita (resposta-do-recurso.js), no mesmo `.badge`. */
export function SeloDaResposta({ estado }) {
  if (!estado) return null;
  return (
    <span
      className={`badge ${BADGE_DO_TOM[tomDoEstado(estado)] || "neutro"}`}
      title="Resposta ao candidato"
    >
      Resposta: {rotuloDoEstado(estado).toLowerCase()}
    </span>
  );
}

export function MarcaForaDasAnalises() {
  return <span className="badge neutro">Fora das análises</span>;
}

/* Prazo com o destaque de atraso: vencido (vermelho), vence em até 2 dias (âmbar). */
export function detalheDoPrazo(recurso) {
  const { prazo, diasParaPrazo, atrasado, etapas } = recurso;
  if (!prazo.data) return { data: "", texto: "Não encontrado", tom: "neutral" };
  const respondido = etapas.resposta_candidato;
  const tom = atrasado
    ? "danger"
    : !respondido && diasParaPrazo <= 2
      ? "warning"
      : "neutral";
  const texto = respondido
    ? "respondido"
    : atrasado
      ? `vencido há ${formatNumberBR(-diasParaPrazo)} ${diasParaPrazo === -1 ? "dia" : "dias"}`
      : diasParaPrazo === 0
        ? "vence hoje"
        : `em ${formatNumberBR(diasParaPrazo)} ${diasParaPrazo === 1 ? "dia" : "dias"}`;
  return {
    data: `${dataBR(prazo.data)}${prazo.fonte === "abertura" ? "*" : ""}`,
    texto,
    tom,
  };
}

/*
  Recurso decidido: selo estático "No prazo" (verde) ou "Fora do prazo"
  (neutro), pela data da decisão contra o prazo do cronograma. Faz parte das
  comemorações (marcos do processo): some com elas desligadas. Sem confete.
*/
export function SeloDoPrazoCumprido({ recurso, ligado = true }) {
  if (!ligado || typeof recurso?.noPrazo !== "boolean") return null;
  return recurso.noPrazo ? (
    <span
      className="badge aprovado recursos-no-prazo"
      title="Decidido dentro do prazo de resposta"
    >
      No prazo
    </span>
  ) : (
    <span
      className="badge neutro recursos-no-prazo"
      title="Decidido depois do prazo de resposta"
    >
      Fora do prazo
    </span>
  );
}

function Prazo({ recurso, comemoracoes }) {
  const { data, texto, tom } = detalheDoPrazo(recurso);
  return (
    <div title={recurso.prazo.aviso || recurso.prazo.atividade || undefined}>
      <div className="primary-text">{data || "—"}</div>
      <span className="secondary-text recursos-prazo" data-tone={tom}>
        {texto}
      </span>
      <SeloDoPrazoCumprido recurso={recurso} ligado={comemoracoes} />
    </div>
  );
}

export function MarcasDasEtapas({ etapas }) {
  return (
    <span
      className="recursos-etapas"
      aria-label={`${ETAPAS.filter((e) => etapas[e.id]).length} de ${ETAPAS.length} etapas`}
    >
      {ETAPAS.map((etapa) => (
        <span
          key={etapa.id}
          className={classes(
            "recursos-etapa-marca",
            etapas[etapa.id] && "is-feita",
          )}
          title={`${etapa.rotulo}: ${etapas[etapa.id] ? "feito" : "pendente"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function LinhasDoEsqueleto() {
  return Array.from({ length: LINHAS_DO_ESQUELETO }, (_, linha) => (
    <tr key={linha} aria-hidden="true">
      {COLUNAS.map(([rotulo]) => (
        <td key={rotulo}>
          <span>&nbsp;</span>
        </td>
      ))}
    </tr>
  ));
}

export function TabelaDeRecursos({
  recursos,
  total,
  origens,
  carregado,
  podeEditar,
  aoAbrir,
  aoNovo,
  comemoracoes = false,
}) {
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(POR_VEZ);
  const naFila = useMemo(
    () => filtrarRecursos(recursos, { ...FILTROS_VAZIOS, busca }),
    [recursos, busca],
  );
  useEffect(() => setLimite(POR_VEZ), [naFila]);
  const visiveis = naFila.slice(0, limite);
  const faltam = naFila.length - visiveis.length;

  function aoRolar(evento) {
    const caixa = evento.currentTarget;
    if (
      faltam > 0 &&
      caixa.scrollTop + caixa.clientHeight >=
        caixa.scrollHeight - PERTO_DO_FIM_PX
    )
      setLimite((atual) => atual + POR_VEZ);
  }

  return (
    <section className="panel table-card" aria-labelledby="recursosFilaTitulo">
      <div className="table-head">
        <div>
          <h2 className="title" id="recursosFilaTitulo">
            Fila de recursos
          </h2>
        </div>
        <div className="table-tools">
          <input
            type="search"
            id="tableSearch"
            value={busca}
            disabled={!carregado}
            placeholder="Buscar somente na fila de recursos"
            aria-label="Buscar somente na fila de recursos"
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>
      </div>
      <div className="table-meta">
        <span id="tableInfo">
          {carregado
            ? `Mostrando ${formatNumberBR(visiveis.length)} de ${formatNumberBR(naFila.length)} registros`
            : "Mostrando 0 de 0 registros"}
        </span>
        <span id="pageInfo">
          <span id="recursosContagem">
            {carregado
              ? naFila.length === total
                ? `${formatNumberBR(total)} ${total === 1 ? "recurso" : "recursos"}`
                : `${formatNumberBR(naFila.length)} de ${formatNumberBR(total)}`
              : "Carregando…"}
          </span>
        </span>
      </div>
      <div className="table-wrap" onScroll={aoRolar}>
        <table>
          <thead>
            <tr>
              {COLUNAS.map(([rotulo, largura]) => (
                <th key={rotulo} scope="col" style={{ width: largura }}>
                  {rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody id="tableBody">
            {!carregado ? (
              <LinhasDoEsqueleto />
            ) : visiveis.length ? (
              visiveis.map((r) => (
                <tr
                  key={r.id}
                  className="recursos-linha"
                  tabIndex={0}
                  onClick={() => aoAbrir(r.id)}
                  onKeyDown={(evento) => {
                    if (
                      evento.target === evento.currentTarget &&
                      (evento.key === "Enter" || evento.key === " ")
                    ) {
                      evento.preventDefault();
                      aoAbrir(r.id);
                    }
                  }}
                  aria-label={`Recurso nº ${r.nu} de ${r.candidato}`}
                >
                  <td>
                    <div className="primary-text">{r.nu}</div>
                  </td>
                  <td>
                    <div className="primary-text">{r.candidato}</div>
                    <span className="secondary-text">
                      {[
                        r.codigo && `Cód. ${r.codigo}`,
                        r.vaga && `Vaga ${r.vaga}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || r.cargo}
                    </span>
                    {r.fora_analise ? <MarcaForaDasAnalises /> : null}
                  </td>
                  <td>
                    <div className="primary-text">{r.edital}</div>
                    <span className="secondary-text">{r.unidade}</span>
                  </td>
                  <td>{rotuloDaOrigem(r.origem, origens)}</td>
                  <td>{r.analista || "Sem analista"}</td>
                  <td>
                    <SeloDaSituacao situacao={r.situacao} />
                    <SeloDaResposta estado={r.respostaEstado} />
                  </td>
                  <td>
                    <MarcasDasEtapas etapas={r.etapas} />
                  </td>
                  <td>
                    <Prazo recurso={r} comemoracoes={comemoracoes} />
                  </td>
                  <td>
                    {r.diasEmAberto === null || r.diasEmAberto === undefined
                      ? "—"
                      : `${formatNumberBR(r.diasEmAberto)} d`}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={(evento) => {
                        evento.stopPropagation();
                        aoAbrir(r.id);
                      }}
                    >
                      <i
                        className="fa-solid fa-chevron-down"
                        aria-hidden="true"
                      />{" "}
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={COLUNAS.length} className="empty">
                  {total ? (
                    "Nenhum registro encontrado."
                  ) : (
                    <>
                      Nenhum recurso cadastrado nesta área.{" "}
                      {podeEditar ? (
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={aoNovo}
                        >
                          <i className="fa-solid fa-plus" aria-hidden="true" />{" "}
                          Cadastrar o primeiro
                        </button>
                      ) : null}
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {carregado && naFila.length ? (
        <div
          className="analises-infinite-status"
          role="status"
          aria-live="polite"
        >
          {faltam > 0
            ? `${formatNumberBR(visiveis.length)} de ${formatNumberBR(naFila.length)} registros`
            : `Todos os ${formatNumberBR(naFila.length)} registros do recorte foram carregados`}
        </div>
      ) : null}
    </section>
  );
}
