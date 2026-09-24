import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  STATUS_EXCEPCIONAIS,
  aplicarDatasEmLote,
  etapasDoModeloPadrao,
  formatarDataHora,
  novaEtapa,
  renumerar,
} from "../../lib/cronograma-do-edital.js";
import { editaisComCronogramaParaCopiar } from "../../lib/editais-do-nucleo.js";

/*
  A seção "Cronograma do edital" do formulário. O rascunho (`cronograma`) e o
  que o calculado diz (`previa`) são de `modal-do-edital.jsx`; aqui fica o
  desenho e as ferramentas de preenchimento:

  - o modelo padrão, que cria as doze atividades de um edital da AgSUS e abre
    o preenchimento em lote, onde se colam as datas uma por linha;
  - "copiar cronograma de outro edital", a partir do resumo do Núcleo (a mesma
    carga dos indicadores da página).

  Classes de `nucleo-cronograma*.css` e `nucleo-operational-enhancements.css`.
*/

const txt = (valor) => String(valor ?? "").trim();
const plural = (total, um, varios) => `${total} ${total === 1 ? um : varios}`;

function CopiaDeCronograma({ estado, idAtual, aoCopiar }) {
  const { geracao } = useSyncExternalStore(estado.assinar, estado.obter);
  const [catalogo, setCatalogo] = useState({ geracao: -1, lista: [] });
  const [origem, setOrigem] = useState("");
  const [aviso, setAviso] = useState(null);
  const [copiando, setCopiando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const pedidoEm = estado.obter().geracao;
    estado
      .editaisParaCopiar()
      .then((lista) => {
        // Resposta que chegou depois de trocar de usuário não é desta sessão.
        if (vivo && estado.obter().geracao === pedidoEm)
          setCatalogo({ geracao: pedidoEm, lista: lista || [] });
      })
      .catch((erro) => {
        if (vivo && estado.obter().geracao === pedidoEm)
          setAviso({
            texto: `Não foi possível carregar os editais de origem: ${erro?.message || erro}`,
            tom: "error",
          });
      });
    return () => {
      vivo = false;
    };
  }, [estado]);

  const carregado = catalogo.geracao === geracao;
  const opcoes = carregado
    ? editaisComCronogramaParaCopiar(catalogo.lista, idAtual)
    : [];
  const avisoVisivel =
    aviso ||
    (carregado && !opcoes.length
      ? {
          texto: "Nenhum outro edital possui cronograma cadastrado.",
          tom: "warning",
        }
      : null);

  async function copiar() {
    if (copiando || !origem) return;
    const fonte = opcoes.find((item) => String(item.id) === origem);
    if (
      !estado.confirmar(
        `Substituir o cronograma atual pelas etapas de ${fonte?.edital || "outro edital"}?`,
      )
    )
      return;
    setCopiando(true);
    try {
      const dados = await estado.lerCronograma(origem);
      const etapas = Array.isArray(dados?.etapas) ? dados.etapas : [];
      if (!etapas.length)
        throw new Error("O edital selecionado não possui etapas cadastradas.");
      aoCopiar(
        etapas.map((etapa, indice) =>
          novaEtapa(
            {
              atividade: etapa.atividade,
              data_inicio: etapa.data_inicio,
              data_fim: etapa.data_fim,
              observacao: etapa.observacao,
            },
            indice + 1,
          ),
        ),
        fonte,
      );
      setAviso({
        texto: `${etapas.length} etapas copiadas. Revise as datas e salve o edital de destino.`,
        tom: "success",
      });
    } catch (erro) {
      setAviso({
        texto: `Erro ao copiar cronograma: ${erro?.message || erro}`,
        tom: "error",
      });
    } finally {
      setCopiando(false);
    }
  }

  return (
    <section id="cronogramaCopyBox" className="cronograma-copy-box">
      <div className="cronograma-copy-heading">
        <div>
          <span>Reaproveitamento</span>
          <strong>Copiar cronograma de outro edital</strong>
          <small>
            Serão copiadas somente atividades, datas e observações das etapas.
          </small>
        </div>
      </div>
      <div className="cronograma-copy-controls">
        <select
          id="cronogramaCopySource"
          aria-label="Edital de origem"
          value={origem}
          onChange={(evento) => {
            setOrigem(evento.target.value);
            setAviso(null);
          }}
        >
          <option value="">Selecione um edital com cronograma...</option>
          {opcoes.map((item) => (
            <option key={item.id} value={String(item.id)}>
              {`${item.unidade || "Unidade não informada"} — ${item.edital || "Edital sem número"} (${Number(item.cronograma_total || 0)} etapas)`}
            </option>
          ))}
        </select>
        <button
          type="button"
          id="cronogramaCopyApply"
          className="btn secondary"
          disabled={!origem || copiando}
          onClick={() => void copiar()}
        >
          {copiando ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />{" "}
              Copiando...
            </>
          ) : (
            <>
              <i className="fa-solid fa-copy" aria-hidden="true" /> Copiar
              etapas
            </>
          )}
        </button>
      </div>
      <div
        id="cronogramaCopyFeedback"
        className={`cronograma-copy-feedback is-${avisoVisivel?.tom || "info"}`}
        hidden={!avisoVisivel}
      >
        {avisoVisivel?.texto || ""}
      </div>
    </section>
  );
}

function Validacao({ erroDeCarga, analise }) {
  if (erroDeCarga)
    return (
      <div id="cronogramaValidation" className="cronograma-validation">
        <div className="cronograma-validation-errors">
          Erro ao carregar cronograma: {erroDeCarga}
        </div>
      </div>
    );
  const { erros, avisos } = analise;
  return (
    <div
      id="cronogramaValidation"
      className="cronograma-validation"
      hidden={!erros.length && !avisos.length}
    >
      {erros.length ? (
        <div className="cronograma-validation-errors">
          <strong>
            <i className="fa-solid fa-circle-xmark" aria-hidden="true" />{" "}
            Corrija antes de salvar
          </strong>
          <ul>
            {erros.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {avisos.length ? (
        <div className="cronograma-validation-warnings">
          <strong>
            <i
              className="fa-solid fa-triangle-exclamation"
              aria-hidden="true"
            />{" "}
            Pontos para revisão
          </strong>
          <ul>
            {avisos.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LoteDeDatas({ aberto, aoFechar, aoAplicar, campo }) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState(null);
  return (
    <section
      id="cronogramaBulkDates"
      className="cronograma-bulk-dates"
      hidden={!aberto}
    >
      <div className="cronograma-bulk-head">
        <div>
          <span className="cronograma-eyebrow">Preenchimento recomendado</span>
          <h5>Colar datas do cronograma</h5>
          <p>
            Cole uma data ou intervalo por linha, seguindo a ordem das
            atividades do modelo.
          </p>
        </div>
        <button
          id="cronogramaBulkClose"
          type="button"
          className="btn outline"
          onClick={aoFechar}
        >
          Fechar
        </button>
      </div>
      <textarea
        ref={campo}
        id="cronogramaBulkInput"
        rows={8}
        aria-label="Datas do cronograma, uma por linha"
        placeholder={
          "17/06/2026\n18/06/2026 a 20/06/2026\n25/06/2026 a 03/07/2026"
        }
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
      />
      <div
        id="cronogramaBulkFeedback"
        className={`cronograma-bulk-feedback is-${aviso?.tom || "info"}`}
        hidden={!aviso}
      >
        {aviso?.texto || ""}
      </div>
      <div className="cronograma-bulk-actions">
        <button
          id="cronogramaBulkApply"
          type="button"
          className="btn green"
          onClick={() => setAviso(aoAplicar(texto))}
        >
          <i className="fa-solid fa-calendar-check" aria-hidden="true" />{" "}
          Aplicar datas às etapas
        </button>
      </div>
    </section>
  );
}

function HistoricoDoCronograma({ historico }) {
  return (
    <section className="cronograma-history-section">
      <div className="cronograma-history-heading">
        <div>
          <span>Auditoria</span>
          <strong>Histórico do cronograma</strong>
        </div>
        <span id="cronogramaHistoryCount">
          {plural(historico.length, "registro", "registros")}
        </span>
      </div>
      <div id="cronogramaHistory" className="cronograma-history-list">
        {historico.length ? (
          historico.map((item, indice) => (
            <article
              key={`${item.created_at}:${indice}`}
              className="cronograma-history-item"
            >
              <div className="cronograma-history-icon">
                <i
                  className={`fa-solid ${item.acao === "errata" ? "fa-file-pen" : "fa-clock-rotate-left"}`}
                  aria-hidden="true"
                />
              </div>
              <div className="cronograma-history-content">
                <div>
                  <strong>
                    {item.acao === "errata"
                      ? item.numero_errata || "Errata"
                      : "Alteração do cronograma"}
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
          <div className="cronograma-history-empty">
            O histórico aparecerá após o primeiro salvamento.
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * @param {object} props.cronograma rascunho: `{ carregando, erroDeCarga, automatico,
 *   etapas, historico, statusExcepcional, etapaExcepcional, motivoExcepcional,
 *   dataExcepcional, retomada, motivo, errata }`
 * @param {(mudar: (atual: object) => object) => void} props.aoMudar
 */
export function EditorDeCronograma({
  estado,
  idAtual,
  cronograma,
  previa,
  analise,
  aoMudar,
}) {
  const [loteAberto, setLoteAberto] = useState(false);
  const campoDoLote = useRef(null);
  const tabela = useRef(null);
  const c = cronograma;
  const excepcional = Boolean(txt(c.statusExcepcional));

  const mudar = (mudancas) => aoMudar((atual) => ({ ...atual, ...mudancas }));
  const mudarEtapa = (indice, campo, valor) =>
    aoMudar((atual) => ({
      ...atual,
      etapas: atual.etapas.map((etapa, i) => {
        if (i !== indice) return etapa;
        const proxima = { ...etapa, [campo]: valor };
        // Etapa de um dia: o fim acompanha o início até ser informado.
        if (campo === "data_inicio" && !etapa.data_fim)
          proxima.data_fim = valor;
        return proxima;
      }),
    }));

  useEffect(() => {
    if (!loteAberto) return;
    campoDoLote.current?.focus();
    campoDoLote.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "center",
    });
  }, [loteAberto]);

  function usarModeloPadrao() {
    if (
      c.etapas.length &&
      !estado.confirmar("Substituir o cronograma atual pelo modelo padrão?")
    )
      return;
    mudar({ etapas: etapasDoModeloPadrao() });
    setLoteAberto(true);
  }

  function limpar() {
    if (
      !c.etapas.length ||
      estado.confirmar("Remover todas as etapas do cronograma?")
    )
      mudar({ etapas: [] });
  }

  function aplicarLote(texto) {
    const { etapas, aviso } = aplicarDatasEmLote(c.etapas, texto);
    if (aviso.tom !== "error") {
      mudar({ etapas, automatico: true });
      tabela.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
    return aviso;
  }

  return (
    <section id="cronogramaEditor" className="cronograma-editor full">
      <div className="cronograma-heading">
        <div>
          <span className="cronograma-eyebrow">
            Automação de acompanhamento
          </span>
          <h4>Cronograma do edital</h4>
          <p>
            Cadastre as etapas manualmente ou use o modelo padrão. Status e
            etapa serão calculados pelas datas salvas.
          </p>
        </div>
        <label className="cronograma-auto-toggle">
          <input
            id="mCronogramaAutomatico"
            type="checkbox"
            checked={c.automatico}
            onChange={(evento) => mudar({ automatico: evento.target.checked })}
          />
          <span>Automático</span>
        </label>
      </div>

      <div className="cronograma-status-preview" id="cronogramaPreview">
        <div>
          <span>Status calculado</span>
          <strong id="cronogramaStatusPreview">{previa.status}</strong>
        </div>
        <div>
          <span>Etapa calculada</span>
          <strong id="cronogramaEtapaPreview">{previa.etapa}</strong>
        </div>
        <div>
          <span>Próxima atividade</span>
          <strong id="cronogramaProximaPreview">{previa.proxima}</strong>
        </div>
        <div>
          <span>Progresso</span>
          <strong id="cronogramaPercentualPreview">{previa.percentual}%</strong>
        </div>
      </div>

      <div className="cronograma-actions-box cronograma-manual-actions">
        <button
          id="cronogramaAddRow"
          type="button"
          className="btn secondary"
          onClick={() =>
            aoMudar((atual) => ({
              ...atual,
              etapas: [...atual.etapas, novaEtapa({}, atual.etapas.length + 1)],
            }))
          }
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Adicionar etapa
        </button>
        <button
          id="cronogramaExample"
          type="button"
          className="btn secondary"
          title="Criar as atividades padrão e preencher as datas em lote"
          onClick={usarModeloPadrao}
        >
          <i className="fa-solid fa-list-check" aria-hidden="true" /> Usar
          modelo padrão{" "}
          <span className="cronograma-recommended-badge">Recomendado</span>
        </button>
        <button
          id="cronogramaClear"
          type="button"
          className="btn outline"
          onClick={limpar}
        >
          <i className="fa-solid fa-trash" aria-hidden="true" /> Limpar
          cronograma
        </button>
      </div>

      <CopiaDeCronograma
        estado={estado}
        idAtual={idAtual}
        aoCopiar={(etapas, fonte) =>
          aoMudar((atual) => ({
            ...atual,
            etapas,
            automatico: true,
            motivo:
              txt(atual.motivo) ||
              `Cronograma copiado do edital ${fonte?.edital || "selecionado"} — ${fonte?.unidade || ""}`.trim(),
          }))
        }
      />

      <Validacao erroDeCarga={c.erroDeCarga} analise={analise} />

      <LoteDeDatas
        aberto={loteAberto}
        campo={campoDoLote}
        aoFechar={() => setLoteAberto(false)}
        aoAplicar={aplicarLote}
      />

      <div className="cronograma-view-hint">
        <i className="fa-solid fa-calendar-days" aria-hidden="true" />
        <span>
          Este é o cronograma oficial do edital. Para consultá-lo novamente,
          abra o edital pelo botão <strong>Editar</strong>.
        </span>
      </div>

      <div className="cronograma-table-wrap" ref={tabela}>
        <table className="cronograma-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Atividade</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Origem</th>
              <th>
                <span className="sr-only">Remover</span>
              </th>
            </tr>
          </thead>
          <tbody id="cronogramaRows">
            {c.carregando ? (
              <tr>
                <td colSpan={6} className="cronograma-empty">
                  Carregando cronograma...
                </td>
              </tr>
            ) : c.etapas.length ? (
              c.etapas.map((etapa, indice) => (
                <tr key={indice} data-cronograma-index={indice}>
                  <td>
                    <strong>{indice + 1}</strong>
                  </td>
                  <td>
                    <input
                      data-field="atividade"
                      aria-label={`Atividade da etapa ${indice + 1}`}
                      placeholder="Nome da atividade"
                      value={etapa.atividade}
                      onChange={(evento) =>
                        mudarEtapa(indice, "atividade", evento.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      data-field="data_inicio"
                      type="date"
                      aria-label={`Início da etapa ${indice + 1}`}
                      value={etapa.data_inicio}
                      onChange={(evento) =>
                        mudarEtapa(indice, "data_inicio", evento.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      data-field="data_fim"
                      type="date"
                      aria-label={`Fim da etapa ${indice + 1}`}
                      value={etapa.data_fim}
                      onChange={(evento) =>
                        mudarEtapa(indice, "data_fim", evento.target.value)
                      }
                    />
                  </td>
                  <td>
                    <span className="cronograma-origin">{etapa.origem}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="cronograma-remove"
                      title="Remover"
                      aria-label={`Remover a etapa ${indice + 1}`}
                      onClick={() =>
                        aoMudar((atual) => ({
                          ...atual,
                          etapas: renumerar(
                            atual.etapas.filter((_, i) => i !== indice),
                          ),
                        }))
                      }
                    >
                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="cronograma-empty">
                  Nenhuma etapa cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="cronograma-overrides">
        <div className="form-row">
          <label htmlFor="mStatusOverride">Status manual excepcional</label>
          <select
            id="mStatusOverride"
            value={c.statusExcepcional}
            onChange={(evento) =>
              mudar({ statusExcepcional: evento.target.value })
            }
          >
            <option value="">Sem substituição</option>
            {STATUS_EXCEPCIONAIS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="mEtapaOverride">Etapa manual excepcional</label>
          <input
            id="mEtapaOverride"
            placeholder="Use somente quando o cronograma não refletir a situação real"
            value={c.etapaExcepcional}
            onChange={(evento) =>
              mudar({ etapaExcepcional: evento.target.value })
            }
          />
        </div>
        <div
          className="form-row cronograma-override-detail"
          hidden={!excepcional}
        >
          <label htmlFor="mStatusOverrideMotivo">
            Motivo do status excepcional *
          </label>
          <input
            id="mStatusOverrideMotivo"
            maxLength={500}
            placeholder="Informe o ato ou motivo da decisão"
            value={c.motivoExcepcional}
            onChange={(evento) =>
              mudar({ motivoExcepcional: evento.target.value })
            }
          />
        </div>
        <div
          className="form-row cronograma-override-detail"
          hidden={!excepcional}
        >
          <label htmlFor="mStatusOverrideData">Data da decisão *</label>
          <input
            id="mStatusOverrideData"
            type="date"
            value={c.dataExcepcional}
            onChange={(evento) =>
              mudar({ dataExcepcional: evento.target.value })
            }
          />
        </div>
        <div
          className="form-row cronograma-override-detail"
          hidden={!excepcional}
        >
          <label htmlFor="mStatusOverrideRetomada">Previsão de retomada</label>
          <input
            id="mStatusOverrideRetomada"
            type="date"
            value={c.retomada}
            onChange={(evento) => mudar({ retomada: evento.target.value })}
          />
        </div>
      </div>

      <section className="cronograma-governance">
        <div className="cronograma-governance-heading">
          <div>
            <span>Governança</span>
            <strong>Registro da alteração</strong>
          </div>
          <small>O motivo será armazenado no histórico do edital.</small>
        </div>
        <div className="cronograma-governance-grid">
          <div className="form-row">
            <label htmlFor="mCronogramaMotivo">Motivo da alteração *</label>
            <textarea
              id="mCronogramaMotivo"
              rows={2}
              maxLength={500}
              placeholder="Ex.: cadastro inicial, ajuste de datas ou atualização conforme publicação"
              value={c.motivo}
              onChange={(evento) => mudar({ motivo: evento.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="mCronogramaErrata">Número da errata</label>
            <input
              id="mCronogramaErrata"
              maxLength={100}
              placeholder="Ex.: Errata nº 02/2026"
              value={c.errata}
              onChange={(evento) => mudar({ errata: evento.target.value })}
            />
          </div>
        </div>
      </section>

      <HistoricoDoCronograma historico={c.historico} />
    </section>
  );
}
