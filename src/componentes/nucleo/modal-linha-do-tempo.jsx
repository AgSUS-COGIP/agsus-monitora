import { useEffect, useState } from "react";
import {
  formatarData,
  formatarDataHora,
  hojeEmBrasilia,
  situacaoNaLinhaDoTempo,
} from "../../lib/cronograma-do-edital.js";
import { Modal } from "../modal.jsx";

/*
  Consulta do cronograma de um edital, sem abrir o formulário: status atual,
  situação excepcional, a linha do tempo das etapas e o histórico de
  alterações e erratas. Só leitura.
*/

const ROTULOS = {
  done: "Concluída",
  current: "Em andamento",
  next: "Próxima",
  future: "Futura",
};
const ICONES = {
  done: "fa-check",
  current: "fa-play",
  next: "fa-clock",
  future: "fa-circle",
};

function Conteudo({ dados, agora }) {
  const monitor = dados.monitoramento || {};
  const atual = dados.estado || {};
  const etapas = Array.isArray(dados.etapas) ? dados.etapas : [];
  const historico = Array.isArray(dados.historico) ? dados.historico : [];
  const hoje = hojeEmBrasilia(agora());

  return (
    <>
      <div className="nucleo-timeline-summary">
        <div>
          <span>Status</span>
          <strong>{atual.status || "Cronograma pendente"}</strong>
        </div>
        <div>
          <span>Etapa atual</span>
          <strong>{atual.etapa || "-"}</strong>
        </div>
        <div>
          <span>Próxima atividade</span>
          <strong>{atual.proxima_atividade || "-"}</strong>
        </div>
        <div>
          <span>Progresso</span>
          <strong>{Number(atual.percentual || 0)}%</strong>
        </div>
      </div>
      {monitor.status_override ? (
        <div className="nucleo-timeline-exception">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
          <div>
            <strong>{monitor.status_override}</strong>
            <p>{monitor.status_override_motivo || "Motivo não informado"}</p>
            <small>
              Decisão: {formatarData(monitor.status_override_data)}
              {monitor.status_override_previsao_retomada
                ? ` · Retomada prevista: ${formatarData(monitor.status_override_previsao_retomada)}`
                : ""}
            </small>
          </div>
        </div>
      ) : null}
      <section className="nucleo-timeline-section">
        <div className="nucleo-timeline-section-title">
          <span>Linha do tempo</span>
          <strong>{etapas.length} etapa(s)</strong>
        </div>
        <div className="nucleo-timeline-list">
          {etapas.length ? (
            etapas.map((etapa, indice) => {
              const situacao = situacaoNaLinhaDoTempo(
                etapa,
                indice,
                etapas,
                hoje,
              );
              return (
                <article
                  key={`${etapa.ordem}:${indice}`}
                  className={`nucleo-timeline-item is-${situacao}`}
                >
                  <span className="nucleo-timeline-dot">
                    <i
                      className={`fa-solid ${ICONES[situacao]}`}
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <div>
                      <strong>{etapa.atividade || "Etapa sem nome"}</strong>
                      <span>{ROTULOS[situacao]}</span>
                    </div>
                    <p>
                      {formatarData(etapa.data_inicio)}
                      {etapa.data_fim && etapa.data_fim !== etapa.data_inicio
                        ? ` a ${formatarData(etapa.data_fim)}`
                        : ""}
                    </p>
                    {etapa.observacao ? (
                      <small>{etapa.observacao}</small>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="nucleo-timeline-empty">
              Nenhuma etapa cadastrada para este edital.
            </div>
          )}
        </div>
      </section>
      <section className="nucleo-timeline-section">
        <div className="nucleo-timeline-section-title">
          <span>Histórico e erratas</span>
          <strong>{historico.length} registro(s)</strong>
        </div>
        <div className="nucleo-timeline-history">
          {historico.length ? (
            historico.map((item, indice) => (
              <article key={`${item.created_at}:${indice}`}>
                <i
                  className={`fa-solid ${item.acao === "errata" ? "fa-file-pen" : "fa-clock-rotate-left"}`}
                  aria-hidden="true"
                />
                <div>
                  <div>
                    <strong>
                      {item.numero_errata ||
                        (item.acao === "errata" ? "Errata" : "Alteração")}
                    </strong>
                    <span>{formatarDataHora(item.created_at)}</span>
                  </div>
                  <p>{item.motivo || "Sem motivo informado"}</p>
                  <small>
                    {item.created_by_email || "Usuário autenticado"} ·{" "}
                    {Number(item.total_alteracoes || 0)} alteração(ões)
                  </small>
                </div>
              </article>
            ))
          ) : (
            <div className="nucleo-timeline-empty">
              Nenhuma alteração auditada.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function ModalLinhaDoTempo({ estado, id, agora = () => new Date() }) {
  const [carga, setCarga] = useState({ estado: "carregando" });

  useEffect(() => {
    let vivo = true;
    estado
      .lerCronograma(id)
      .then((dados) => vivo && setCarga({ estado: "pronto", dados }))
      .catch(
        (erro) =>
          vivo &&
          setCarga({ estado: "erro", mensagem: erro?.message || String(erro) }),
      );
    return () => {
      vivo = false;
    };
  }, [estado, id]);

  const monitor = carga.dados?.monitoramento || {};
  return (
    <Modal
      id="nucleoTimelineModal"
      className="nucleo-timeline-modal"
      cartaoClassName="nucleo-timeline-card"
      rotuloId="nucleoTimelineTitle"
      aoFechar={estado.fecharModal}
    >
      <div className="modal-head">
        <div>
          <span className="nucleo-timeline-eyebrow">
            Acompanhamento do edital
          </span>
          <h3 id="nucleoTimelineTitle">
            {carga.estado === "pronto"
              ? monitor.edital || "Cronograma do edital"
              : "Cronograma"}
          </h3>
          <p id="nucleoTimelineSubtitle">{monitor.unidade || ""}</p>
        </div>
        <button
          type="button"
          id="closeNucleoTimeline"
          className="btn outline"
          onClick={estado.fecharModal}
        >
          Fechar
        </button>
      </div>
      <div id="nucleoTimelineContent" className="nucleo-timeline-content">
        {carga.estado === "carregando" ? (
          <div className="nucleo-timeline-loading">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />{" "}
            Carregando cronograma...
          </div>
        ) : carga.estado === "erro" ? (
          <div className="nucleo-timeline-error">
            Erro ao carregar cronograma: {carga.mensagem}
          </div>
        ) : (
          <Conteudo dados={carga.dados} agora={agora} />
        )}
      </div>
    </Modal>
  );
}
