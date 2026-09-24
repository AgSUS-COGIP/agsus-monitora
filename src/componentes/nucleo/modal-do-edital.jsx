import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { RESPONSAVEIS_DE_EDITAL } from "../../lib/responsavel-do-edital.js";
import {
  camposDaUnidade,
  editalParaSalvar,
  formatarNumero,
  formularioDoEdital,
  opcoesDeUnidade,
  rotuloDaUnidade,
  valorDaUnidade,
} from "../../lib/editais-do-nucleo.js";
import {
  analisarCronograma,
  estadoDoCronograma,
  novaEtapa,
} from "../../lib/cronograma-do-edital.js";
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../dados-do-monitoramento.js";
import { Modal } from "../modal.jsx";
import { EditorDeCronograma } from "./editor-de-cronograma.jsx";

/*
  O formulário do edital: identificação, situação operacional, indicadores que
  o banco calcula (só leitura), o cronograma e as observações. Abre de uma
  linha da tabela ou do "+ Novo"; salva numa só RPC, com o motivo no histórico
  (`estado.salvarEdital`).

  O rascunho nasce do edital gravado a cada abertura. O cronograma chega depois
  (`get_monitoramento_cronograma`); até lá a tabela de etapas diz que está a
  carregar.
*/

const txt = (valor) => String(valor ?? "").trim();

const RISCOS = ["Baixo", "Médio", "Alto"];

const INDICADORES = [
  ["mAutoInscritos", "Inscritos", "inscritos"],
  ["mAutoAptosAnalise", "Aptos análise", "aptos_analise"],
  ["mAutoCancelados", "Cancelados", "cancelados"],
  ["mAutoEliminadosNota", "Eliminados nota", "eliminados_nota"],
  ["mAutoReprovadosAnalise", "Reprovados análise", "reprovados_analise"],
  ["mAutoTotalEliminados", "Total eliminados", "total_eliminados"],
  ["mAutoAprovadosAnalise", "Aprovados análise", "aprovados_analise"],
  ["mAutoAprovadosProva", "Aprovados prova", "aprovados_prova"],
  ["mAutoEntrevistados", "Entrevistados", "entrevistados"],
  ["mAutoContratados", "Contratados", "contratados"],
  ["mAutoOciosas", "Vagas ociosas", "vagas_ociosas"],
];

const CRONOGRAMA_VAZIO = Object.freeze({
  carregando: false,
  erroDeCarga: "",
  automatico: true,
  etapas: [],
  historico: [],
  statusExcepcional: "",
  etapaExcepcional: "",
  motivoExcepcional: "",
  dataExcepcional: "",
  retomada: "",
  motivo: "",
  errata: "",
});

function cronogramaDoBanco(dados) {
  const monitor = dados?.monitoramento || {};
  return {
    ...CRONOGRAMA_VAZIO,
    automatico: monitor.cronograma_automatico !== false,
    etapas: Array.isArray(dados?.etapas)
      ? dados.etapas.map((etapa, indice) => novaEtapa(etapa, indice + 1))
      : [],
    historico: Array.isArray(dados?.historico) ? dados.historico : [],
    statusExcepcional: txt(monitor.status_override),
    etapaExcepcional: txt(monitor.etapa_override),
    motivoExcepcional: txt(monitor.status_override_motivo),
    dataExcepcional: txt(monitor.status_override_data),
    retomada: txt(monitor.status_override_previsao_retomada),
  };
}

function Campo({ id, rotulo, children, largo = false }) {
  return (
    <div className={largo ? "form-row full" : "form-row"}>
      <label htmlFor={id}>{rotulo}</label>
      {children}
    </div>
  );
}

export function ModalDoEdital({ estado, id, agora = () => new Date() }) {
  const { linhas, unidades } = useSyncExternalStore(
    assinarDadosDoMonitoramento,
    obterDadosDoMonitoramento,
  );
  const { salvando } = useSyncExternalStore(estado.assinar, estado.obter);
  const [linha] = useState(
    () => linhas.find((item) => String(item.id) === String(id)) || null,
  );
  const [formulario, setFormulario] = useState(() =>
    formularioDoEdital(linha, unidades, linhas),
  );
  const [cronograma, setCronograma] = useState(() => ({
    ...CRONOGRAMA_VAZIO,
    carregando: Boolean(id),
  }));

  useEffect(() => {
    if (!id) return undefined;
    let vivo = true;
    estado
      .lerCronograma(id)
      .then((dados) => vivo && setCronograma(cronogramaDoBanco(dados)))
      .catch((erro) => {
        console.error("Erro ao carregar cronograma:", erro);
        if (vivo)
          setCronograma({
            ...CRONOGRAMA_VAZIO,
            erroDeCarga: erro?.message || String(erro),
          });
      });
    return () => {
      vivo = false;
    };
  }, [estado, id]);

  const opcoes = useMemo(
    () => opcoesDeUnidade(formulario.responsavel, unidades, linhas),
    [formulario.responsavel, unidades, linhas],
  );
  const unidade =
    opcoes.find((item) => valorDaUnidade(item) === formulario.unidade) || null;
  const previa = estadoDoCronograma(cronograma.etapas, {
    automatico: cronograma.automatico,
    statusExcepcional: cronograma.statusExcepcional,
    etapaExcepcional: cronograma.etapaExcepcional,
    hoje: agora(),
  });
  const edital = editalParaSalvar(formulario, unidade, cronograma, previa);
  const analise = analisarCronograma(
    edital,
    cronograma.etapas,
    cronograma.motivo,
  );
  const automatico = cronograma.automatico;

  const mudar = (campo) => (evento) =>
    setFormulario((atual) => ({ ...atual, [campo]: evento.target.value }));

  function mudarCronograma(transformar) {
    /*
      Desligar o automático devolve o status e a etapa à mão de quem edita, a
      partir do que estava calculado — e não de um valor antigo escondido.
    */
    if (automatico && !transformar(cronograma).automatico)
      setFormulario((atual) => ({
        ...atual,
        status: previa.status,
        etapa: previa.etapa,
      }));
    setCronograma(transformar);
  }

  const fechar = estado.fecharModal;

  return (
    <Modal id="editModal" rotuloId="editModalTitle" aoFechar={fechar}>
      <div className="modal-head">
        <h3 id="editModalTitle">{id ? "Editar edital" : "Novo edital"}</h3>
        <button className="btn secondary" type="button" onClick={fechar}>
          Fechar
        </button>
      </div>
      <div className="modal-body">
        <div className="form-grid">
          <div className="subsection">Identificação do edital</div>
          <Campo id="mProcesso" rotulo="Processo">
            <input
              id="mProcesso"
              data-foco-inicial
              placeholder="Processo SEI"
              value={formulario.processo}
              onChange={mudar("processo")}
            />
          </Campo>
          <Campo id="mEdital" rotulo="Edital">
            <input
              id="mEdital"
              placeholder="Número do edital"
              value={formulario.edital}
              onChange={mudar("edital")}
            />
          </Campo>
          <Campo id="mResponsavel" rotulo="Responsável">
            {/*
              O responsável decide de que catálogo vêm as unidades. Trocá-lo
              limpa a unidade: a escolhida não existe na outra lista.
            */}
            <select
              id="mResponsavel"
              value={formulario.responsavel}
              onChange={(evento) =>
                setFormulario((atual) => ({
                  ...atual,
                  responsavel: evento.target.value,
                  unidade: "",
                  ...camposDaUnidade(null),
                }))
              }
            >
              <option value="">Selecione o responsável</option>
              {RESPONSAVEIS_DE_EDITAL.map((responsavel) => (
                <option key={responsavel} value={responsavel}>
                  {responsavel}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="mUnidade" rotulo="Unidade">
            <select
              id="mUnidade"
              value={formulario.unidade}
              onChange={(evento) => {
                const valor = evento.target.value;
                const escolhida =
                  opcoes.find((item) => valorDaUnidade(item) === valor) || null;
                setFormulario((atual) => ({
                  ...atual,
                  unidade: valor,
                  ...camposDaUnidade(escolhida),
                }));
              }}
            >
              <option value="">Selecione a unidade</option>
              {opcoes.map((item) => (
                <option key={valorDaUnidade(item)} value={valorDaUnidade(item)}>
                  {rotuloDaUnidade(item)}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="mUf" rotulo="UF">
            <input
              id="mUf"
              maxLength={2}
              placeholder="UF"
              readOnly
              title="Preenchida automaticamente pela unidade selecionada"
              value={formulario.uf}
            />
          </Campo>
          <Campo id="mLink" rotulo="Link do edital">
            <input
              id="mLink"
              placeholder="https://..."
              value={formulario.link}
              onChange={mudar("link")}
            />
          </Campo>

          <div className="subsection">Situação operacional</div>
          <Campo id="mVagas" rotulo="Vagas previstas">
            <input
              id="mVagas"
              type="number"
              min="0"
              value={formulario.vagas}
              onChange={mudar("vagas")}
            />
          </Campo>
          <Campo id="mDataInicio" rotulo="Data de início">
            <input
              id="mDataInicio"
              type="date"
              value={formulario.dataInicio}
              onChange={mudar("dataInicio")}
            />
          </Campo>
          <Campo id="mDataFim" rotulo="Data de encerramento">
            <input
              id="mDataFim"
              type="date"
              value={formulario.dataFim}
              onChange={mudar("dataFim")}
            />
          </Campo>
          {/* Com o cronograma automático, status e etapa são o que as datas dizem. */}
          <Campo id="mStatus" rotulo="Status">
            <input
              id="mStatus"
              placeholder="Ex.: Em andamento, Concluído"
              readOnly={automatico}
              value={automatico ? previa.status : formulario.status}
              onChange={mudar("status")}
            />
          </Campo>
          <Campo id="mEtapa" rotulo="Etapa">
            <input
              id="mEtapa"
              placeholder="Ex.: Análise Curricular"
              readOnly={automatico}
              value={automatico ? previa.etapa : formulario.etapa}
              onChange={mudar("etapa")}
            />
          </Campo>
          <Campo id="mRisco" rotulo="Risco">
            <select
              id="mRisco"
              value={formulario.risco}
              onChange={mudar("risco")}
            >
              {RISCOS.map((risco) => (
                <option key={risco} value={risco}>
                  {risco}
                </option>
              ))}
            </select>
          </Campo>

          <div className="subsection">Indicadores automáticos</div>
          <p className="modal-note">
            Campos calculados ou sincronizados automaticamente. Eles aparecem
            para conferência, mas não são alterados por este formulário.
          </p>
          <div className="readonly-metrics full">
            {INDICADORES.map(([chave, rotulo, coluna]) => (
              <div key={chave} className="metric-readonly">
                <span>{rotulo}</span>
                <b id={chave}>{formatarNumero(linha?.[coluna])}</b>
              </div>
            ))}
          </div>

          <EditorDeCronograma
            estado={estado}
            idAtual={id}
            cronograma={cronograma}
            previa={previa}
            analise={analise}
            aoMudar={mudarCronograma}
          />

          <div className="subsection">Observações</div>
          <Campo id="mObs" rotulo="Observações gerenciais" largo>
            <textarea
              id="mObs"
              placeholder="Resumo visível no painel"
              value={formulario.observacoes}
              onChange={mudar("observacoes")}
            />
          </Campo>
          <Campo id="mObsInternas" rotulo="Observações internas" largo>
            <textarea
              id="mObsInternas"
              placeholder="Notas internas da equipe"
              value={formulario.observacoesInternas}
              onChange={mudar("observacoesInternas")}
            />
          </Campo>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 18,
          }}
        >
          <button className="btn secondary" type="button" onClick={fechar}>
            Cancelar
          </button>
          <button
            id="saveEditalBtn"
            className="btn green"
            type="button"
            disabled={salvando || cronograma.carregando}
            onClick={() =>
              void estado.salvarEdital({
                edital,
                etapas: cronograma.etapas,
                motivo: cronograma.motivo,
                errata: cronograma.errata,
              })
            }
          >
            {salvando ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />{" "}
                Salvando cronograma...
              </>
            ) : (
              "Salvar"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
