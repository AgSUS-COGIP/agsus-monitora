import { useState, useSyncExternalStore } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  ETAPAS,
  rotuloDaOrigem,
  rotuloDaSituacao,
} from "../../lib/recursos-dos-candidatos.js";
import { Modal } from "../modal.jsx";
import { classes } from "./paineis.jsx";
import { dataBR, Prazo, SeloDaSituacao } from "./tabela.jsx";

/*
  Gaveta de detalhe do recurso (à direita, como a do painel de análises): os
  dados do candidato (vindos da análise), a nota e o resultado do cadastro
  contra os de hoje, o prazo do cronograma, as etapas com quem e quando, a
  observação e o histórico. Quem edita marca as etapas aqui, edita e exclui.
*/

const dataHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const nota = (valor) =>
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

function Linha({ rotulo, children }) {
  return (
    <div className="recursos-dado">
      <dt>{rotulo}</dt>
      <dd>{children || "—"}</dd>
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

  return (
    <Modal
      id="recursosGaveta"
      rotuloId="recursosGavetaTitulo"
      aoFechar={estado.fecharGaveta}
      className="recursos-modal recursos-gaveta"
      cartaoClassName="recursos-gaveta-cartao"
    >
      <div className="modal-head recursos-gaveta-topo">
        <div>
          <span className="recursos-sobretitulo">
            Recurso nº {r.nu} · {rotuloDaOrigem(r.origem, origens)}
          </span>
          <h3 id="recursosGavetaTitulo">{r.candidato}</h3>
          <p className="recursos-dica">
            {r.edital} · {r.unidade}
          </p>
        </div>
        <button
          type="button"
          className="btn icon outline"
          aria-label="Fechar detalhe"
          title="Fechar"
          onClick={estado.fecharGaveta}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
      <div className="modal-body recursos-gaveta-corpo">
        <div className="recursos-gaveta-selos">
          <SeloDaSituacao situacao={r.situacao} />
          {r.fora_analise ? (
            <span className="recursos-marca-fora">Fora das análises</span>
          ) : null}
          {r.mudouNota ? (
            <span className="recursos-selo" data-tone="info">
              Nota mudou
            </span>
          ) : null}
          {r.mudouClassificacao ? (
            <span className="recursos-selo" data-tone="info">
              Classificação mudou
            </span>
          ) : null}
        </div>

        <section className="recursos-gaveta-secao" aria-label="Candidato">
          <h4>Candidato e vaga</h4>
          <dl className="recursos-dados">
            <Linha rotulo="Código do candidato">{r.codigo}</Linha>
            <Linha rotulo="Cargo">{r.cargo}</Linha>
            <Linha rotulo="Vaga">{r.vaga}</Linha>
            <Linha rotulo="Modalidade">{detalhe?.modalidade}</Linha>
            <Linha rotulo="Analista do recurso">{r.analista}</Linha>
            <Linha rotulo="Responsável pela análise">
              {detalhe?.responsavel_analise}
            </Linha>
            <Linha rotulo="Processo SEI">{r.processo_sei}</Linha>
            <Linha rotulo="Cadastrado">
              {[dataHora(r.criado_em), detalhe?.criado_por]
                .filter(Boolean)
                .join(" · ")}
            </Linha>
          </dl>
        </section>

        {r.fora_analise ? null : (
          <section
            className="recursos-gaveta-secao"
            aria-label="Resultado da análise"
          >
            <h4>Resultado da análise</h4>
            <dl className="recursos-dados">
              <Linha rotulo="Nota no cadastro">{nota(r.nota_anterior)}</Linha>
              <Linha rotulo="Nota atual">
                <span className={classes(r.mudouNota && "recursos-destaque")}>
                  {nota(r.nota_atual)}
                </span>
              </Linha>
              <Linha rotulo="Resultado no cadastro">
                {r.resultado_anterior}
              </Linha>
              <Linha rotulo="Resultado atual">{r.resultado_atual}</Linha>
            </dl>
          </section>
        )}

        <section className="recursos-gaveta-secao" aria-label="Prazo">
          <h4>Prazo de resposta</h4>
          <dl className="recursos-dados">
            <Linha rotulo="Prazo">
              <Prazo recurso={r} />
            </Linha>
            <Linha rotulo="Atividade do cronograma">{r.prazo.atividade}</Linha>
            <Linha rotulo="Dias em aberto">
              {r.diasEmAberto === null ? "" : formatNumberBR(r.diasEmAberto)}
            </Linha>
            {r.decisao_em ? (
              <Linha rotulo="Decidido">
                {[dataHora(r.decisao_em), detalhe?.decisao_por]
                  .filter(Boolean)
                  .join(" · ")}
              </Linha>
            ) : null}
          </dl>
          {r.prazo.aviso ? (
            <p
              className="recursos-aviso"
              data-tone={r.prazo.data ? "info" : "warning"}
            >
              <i className="fa-solid fa-circle-info" aria-hidden="true" />{" "}
              {r.prazo.aviso}
            </p>
          ) : null}
        </section>

        <section className="recursos-gaveta-secao" aria-label="Etapas">
          <h4>Etapas</h4>
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
        </section>

        <section className="recursos-gaveta-secao" aria-label="Observação">
          <h4>Observação</h4>
          <p className="recursos-observacao">
            {carregando
              ? "Carregando…"
              : detalhe?.observacao || "Sem observação."}
          </p>
        </section>

        <section className="recursos-gaveta-secao" aria-label="Histórico">
          <h4>Histórico</h4>
          {erro ? (
            <p className="recursos-aviso" data-tone="danger">
              Não foi possível carregar o histórico. <small>{erro}</small>
            </p>
          ) : carregando ? (
            <p className="recursos-observacao">Carregando…</p>
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
        </section>

        {podeEditar && excluindo ? (
          <form
            className="recursos-exclusao"
            onSubmit={(evento) => {
              evento.preventDefault();
              void estado.excluir(r.id, motivo.trim());
            }}
          >
            <label className="recursos-campo">
              <span>Motivo da exclusão do recurso nº {r.nu}</span>
              <input
                name="motivo"
                value={motivo}
                minLength={3}
                maxLength={500}
                required
                data-foco-inicial
                placeholder="Ex.: cadastrado em duplicidade"
                onChange={(evento) => setMotivo(evento.target.value)}
              />
            </label>
            <div className="recursos-acoes">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setExcluindo(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn danger"
                disabled={motivo.trim().length < 3 || Boolean(acao)}
              >
                {acao?.tipo === "excluir" ? acao.rotulo : "Excluir recurso"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
      {podeEditar && !excluindo ? (
        <div className="recursos-gaveta-rodape">
          <button
            type="button"
            className="btn secondary"
            disabled={Boolean(acao)}
            onClick={() => setExcluindo(true)}
          >
            <i className="fa-solid fa-trash" aria-hidden="true" /> Excluir
          </button>
          <button
            type="button"
            className="btn"
            disabled={Boolean(acao)}
            onClick={() => estado.abrirEdicao(r.id)}
          >
            <i className="fa-solid fa-pen-to-square" aria-hidden="true" />{" "}
            Editar
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
