import { useState, useSyncExternalStore } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  ETAPAS,
  rotuloDaOrigem,
  rotuloDaSituacao,
} from "../../lib/recursos-dos-candidatos.js";
import { Modal } from "../modal.jsx";
import { classes } from "./paineis.jsx";
import { detalheDoPrazo, MarcaForaDasAnalises } from "./tabela.jsx";

/*
  Gaveta de detalhe do recurso: a mesma do painel de análises
  (`.analises-drawer-backdrop` > `.analises-drawer`, com `.analises-drawer-head`,
  o resumo em pílulas, o contexto em cartões e as seções
  `.analises-detail-section` com `.kv`). Traz os dados do candidato (vindos da
  análise), a nota e o resultado do cadastro contra os de hoje, o prazo do
  cronograma, as etapas com quem e quando, a observação e o histórico. Quem
  edita marca as etapas aqui, edita e exclui.
*/

export const dataHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export const nota = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? "—"
    : formatNumberBR(Number(valor), { maximumFractionDigits: 2 });

const CAMPOS_DO_HISTORICO = {
  origem: "Origem",
  situacao: "Situação",
  analista: "Analista",
  processo_sei: "Processo SEI",
  mudou_classificacao: "Mudou a classificação",
  observacao: "Observação",
  nome_informado: "Nome do candidato",
  codigo_informado: "Código do candidato",
  cargo_informado: "Cargo",
  vaga_informada: "Vaga",
};

function textoDoHistorico(h, origens) {
  if (h.acao === "criacao") return "Cadastrou o recurso";
  if (h.acao === "exclusao")
    return `Excluiu o recurso${h.motivo ? `: ${h.motivo}` : ""}`;
  if (h.acao === "etapa") {
    const etapa = ETAPAS.find((e) => e.id === h.campo)?.rotulo || h.campo;
    return `${h.novo === "S" ? "Marcou" : "Desmarcou"}: ${etapa}`;
  }
  const valor = (v) => {
    if (v === null || v === undefined || v === "") return "vazio";
    if (h.campo === "situacao") return rotuloDaSituacao(v);
    if (h.campo === "origem") return rotuloDaOrigem(v, origens);
    if (h.campo === "mudou_classificacao") return v === "S" ? "Sim" : "Não";
    return v;
  };
  return `${CAMPOS_DO_HISTORICO[h.campo] || h.campo}: ${valor(h.anterior)} → ${valor(h.novo)}`;
}

/* Um `.kv` do painel de análises; vazio, some (`data-empty`). */
export function Kv({ rotulo, children }) {
  const vazio =
    children === null ||
    children === undefined ||
    children === "" ||
    children === "—";
  return (
    <div className="kv" data-empty={vazio || undefined}>
      <div className="kv-label">{rotulo}</div>
      <div className="kv-value">{vazio ? "—" : children}</div>
    </div>
  );
}

export function Secao({ icone, titulo, secao, children }) {
  return (
    <section
      className="analises-detail-section"
      data-section={secao}
      aria-label={titulo}
    >
      <div className="analises-detail-section-head">
        <i className={`fa-solid ${icone}`} aria-hidden="true" />
        <span>{titulo}</span>
      </div>
      {children}
    </section>
  );
}

/* O topo da gaveta (e do formulário): sobretítulo, título, resumo e fechar. */
export function TopoDaGaveta({
  sobretitulo,
  titulo,
  tituloId,
  resumo,
  aoFechar,
  rotuloDoFechar,
}) {
  return (
    <div className="analises-drawer-head">
      <div>
        <span className="eyebrow">{sobretitulo}</span>
        <h2 id={tituloId}>{titulo}</h2>
        {resumo ? (
          <div className="analises-drawer-summary">{resumo}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="analises-drawer-close"
        aria-label={rotuloDoFechar}
        title="Fechar"
        onClick={aoFechar}
      >
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </div>
  );
}

export function GavetaDoRecurso({
  estado,
  recurso: r,
  detalhe,
  origens,
  podeEditar,
}) {
  const { acao } = useSyncExternalStore(estado.assinar, estado.obter);
  const [excluindo, setExcluindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const carregando = !detalhe;
  const erro = detalhe?.erro;
  const prazo = detalheDoPrazo(r);

  return (
    <Modal
      id="recursosGaveta"
      rotuloId="recursosGavetaTitulo"
      aoFechar={estado.fecharGaveta}
      className="analises-drawer-backdrop recursos-gaveta"
      cartaoClassName="analises-drawer"
    >
      <TopoDaGaveta
        sobretitulo={`Recurso nº ${r.nu} · ${rotuloDaOrigem(r.origem, origens)}`}
        titulo={r.candidato}
        tituloId="recursosGavetaTitulo"
        rotuloDoFechar="Fechar detalhe"
        aoFechar={estado.fecharGaveta}
        resumo={
          <>
            <span className="status">
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
              {rotuloDaSituacao(r.situacao)}
            </span>
            <span>
              <i className="fa-solid fa-user-check" aria-hidden="true" />
              {r.analista || "Sem analista"}
            </span>
            {r.fora_analise ? <MarcaForaDasAnalises /> : null}
            {r.mudouNota ? <span>Nota mudou</span> : null}
            {r.mudouClassificacao ? <span>Classificação mudou</span> : null}
          </>
        }
      />
      <div className="analises-drawer-context">
        <div>
          <small>Edital</small>
          <strong>{r.edital}</strong>
        </div>
        <div>
          <small>Unidade</small>
          <strong>{r.unidade || "—"}</strong>
        </div>
        <div>
          <small>Processo SEI</small>
          <strong>{r.processo_sei || "—"}</strong>
        </div>
        <div>
          <small>Prazo</small>
          <strong>
            {prazo.data || "Não encontrado"}
            {prazo.data ? ` · ${prazo.texto}` : ""}
          </strong>
        </div>
        <div>
          <small>Vaga</small>
          <strong>
            {[r.vaga, r.cargo].filter(Boolean).join(" · ") || "—"}
          </strong>
        </div>
      </div>

      <div id="analisesDrawerBody">
        <div className="detail-shell">
          {podeEditar && !excluindo ? (
            <div className="detail-actions">
              <button
                type="button"
                className="btn small"
                disabled={Boolean(acao)}
                onClick={() => estado.abrirEdicao(r.id)}
              >
                <i className="fa-solid fa-pen-to-square" aria-hidden="true" />{" "}
                Editar
              </button>
              <button
                type="button"
                className="btn secondary small"
                disabled={Boolean(acao)}
                onClick={() => setExcluindo(true)}
              >
                <i className="fa-solid fa-trash" aria-hidden="true" /> Excluir
              </button>
            </div>
          ) : null}

          <Secao icone="fa-list-check" titulo="Etapas" secao="etapas">
            <ul className="recursos-checklist">
              {ETAPAS.map((etapa) => {
                const feita = r.etapas[etapa.id];
                const emCurso = acao?.tipo === `etapa:${r.id}:${etapa.id}`;
                return (
                  <li key={etapa.id}>
                    <label
                      className={classes("recursos-check", feita && "is-feita")}
                    >
                      <input
                        type="checkbox"
                        name={etapa.id}
                        checked={feita}
                        disabled={!podeEditar || Boolean(acao)}
                        aria-busy={emCurso || undefined}
                        onChange={(evento) =>
                          void estado.marcarEtapa(
                            r.id,
                            etapa.id,
                            etapa.campo,
                            evento.target.checked,
                          )
                        }
                      />
                      <span>
                        {etapa.rotulo}
                        {feita ? (
                          <small>
                            {[
                              dataHora(r[etapa.campo]),
                              detalhe?.etapas?.[etapa.id],
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Secao>

          {r.fora_analise ? null : (
            <Secao
              icone="fa-chart-simple"
              titulo="Resultado da análise"
              secao="result"
            >
              <div className="analises-detail-section-grid">
                <Kv rotulo="Nota atual">
                  <span className={classes(r.mudouNota && "recursos-destaque")}>
                    {nota(r.nota_atual)}
                  </span>
                </Kv>
                <Kv rotulo="Nota no cadastro">{nota(r.nota_anterior)}</Kv>
                <Kv rotulo="Resultado atual">{r.resultado_atual}</Kv>
                <Kv rotulo="Resultado no cadastro">{r.resultado_anterior}</Kv>
              </div>
            </Secao>
          )}

          <Secao icone="fa-user-check" titulo="Candidato e vaga" secao="score">
            <div className="analises-detail-section-grid">
              <Kv rotulo="Código do candidato">{r.codigo}</Kv>
              <Kv rotulo="Cargo">{r.cargo}</Kv>
              <Kv rotulo="Vaga">{r.vaga}</Kv>
              <Kv rotulo="Modalidade">{detalhe?.modalidade}</Kv>
              <Kv rotulo="Analista do recurso">{r.analista}</Kv>
              <Kv rotulo="Responsável pela análise">
                {detalhe?.responsavel_analise}
              </Kv>
              <Kv rotulo="Cadastrado">
                {[dataHora(r.criado_em), detalhe?.criado_por]
                  .filter(Boolean)
                  .join(" · ")}
              </Kv>
            </div>
          </Secao>

          <Secao
            icone="fa-calendar-days"
            titulo="Prazo de resposta"
            secao="prazo"
          >
            <div className="analises-detail-section-grid">
              <Kv rotulo="Prazo">
                {prazo.data ? `${prazo.data} · ${prazo.texto}` : prazo.texto}
              </Kv>
              <Kv rotulo="Atividade do cronograma">{r.prazo.atividade}</Kv>
              <Kv rotulo="Dias em aberto">
                {r.diasEmAberto === null || r.diasEmAberto === undefined
                  ? ""
                  : formatNumberBR(r.diasEmAberto)}
              </Kv>
              {r.decisao_em ? (
                <Kv rotulo="Decidido">
                  {[dataHora(r.decisao_em), detalhe?.decisao_por]
                    .filter(Boolean)
                    .join(" · ")}
                </Kv>
              ) : null}
            </div>
            {r.prazo.aviso ? (
              <p
                className="recursos-aviso"
                data-tone={r.prazo.data ? "info" : "warning"}
              >
                <i className="fa-solid fa-circle-info" aria-hidden="true" />{" "}
                {r.prazo.aviso}
              </p>
            ) : null}
          </Secao>

          <Secao icone="fa-circle-info" titulo="Observação" secao="observacao">
            <div className="analises-detail-analysis">
              {carregando ? (
                "Carregando…"
              ) : detalhe?.observacao ? (
                detalhe.observacao
              ) : (
                <span className="analises-detail-empty">Sem observação.</span>
              )}
            </div>
          </Secao>

          <Secao
            icone="fa-clock-rotate-left"
            titulo="Histórico"
            secao="historico"
          >
            {erro ? (
              <p className="recursos-aviso" data-tone="danger">
                Não foi possível carregar o histórico. <small>{erro}</small>
              </p>
            ) : carregando ? (
              <div className="analises-detail-analysis">Carregando…</div>
            ) : (
              <ol className="recursos-historico">
                {(detalhe.historico || []).map((h, indice) => (
                  <li key={`${h.em}-${indice}`}>
                    <span>{textoDoHistorico(h, origens)}</span>
                    <small>
                      {dataHora(h.em)}
                      {h.autor ? ` · ${h.autor}` : ""}
                    </small>
                  </li>
                ))}
              </ol>
            )}
          </Secao>

          {podeEditar && excluindo ? (
            <form
              className="detail-block recursos-exclusao"
              onSubmit={(evento) => {
                evento.preventDefault();
                void estado.excluir(r.id, motivo.trim());
              }}
            >
              <div className="field">
                <label htmlFor="recursosMotivoDaExclusao">
                  Motivo da exclusão do recurso nº {r.nu}
                </label>
                <input
                  id="recursosMotivoDaExclusao"
                  name="motivo"
                  value={motivo}
                  minLength={3}
                  maxLength={500}
                  required
                  data-foco-inicial
                  placeholder="Ex.: cadastrado em duplicidade"
                  onChange={(evento) => setMotivo(evento.target.value)}
                />
              </div>
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setExcluindo(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn danger small"
                  disabled={motivo.trim().length < 3 || Boolean(acao)}
                >
                  {acao?.tipo === "excluir" ? acao.rotulo : "Excluir recurso"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
