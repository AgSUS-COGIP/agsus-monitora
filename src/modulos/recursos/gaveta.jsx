import { useState, useSyncExternalStore } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  ETAPAS,
  rotuloDaOrigem,
  rotuloDaSituacao,
} from "../../lib/recursos-dos-candidatos.js";
import { rotuloDoEstado } from "../../lib/resposta-do-recurso.js";
import {
  Aviso,
  Carregando,
  classes,
  Gaveta,
  Kv,
  Secao,
} from "../../ui/index.js";
import { SecaoDoAjuste } from "./ajuste.jsx";
import { SecaoDeAnexos } from "./anexos.jsx";
import { SecaoDoParecer } from "./parecer.jsx";
import { dataHora, nota } from "./partes.jsx";
import { SecaoDaResposta } from "./resposta.jsx";
import { detalheDoPrazo, MarcaForaDasAnalises } from "./tabela.jsx";

/*
  Gaveta de detalhe do recurso (Gaveta, src/ui/): o topo com o resumo em
  pílulas, o contexto em cartões e as seções (Secao, Kv). Traz os dados do
  candidato (vindos da
  análise), a nota e o resultado do cadastro contra os de hoje, o prazo do
  cronograma, o parecer jurídico (parecer.jsx), o ajuste da pontuação
  (ajuste.jsx), as etapas com quem e quando,
  a resposta ao candidato
  (resposta.jsx), os anexos (anexos.jsx), a observação e o histórico. Quem
  edita marca as etapas aqui, escreve a resposta, anexa, edita e exclui.
*/

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

const ACOES_DO_PARECER_NO_HISTORICO = {
  enviar_parecer: "Enviou para parecer jurídico",
  devolver: "Devolveu para ajuste",
  deferir: "Deferiu",
  deferir_parcialmente: "Deferiu parcialmente",
  indeferir: "Indeferiu",
  reabrir: "Reabriu a decisão",
};

const ACOES_DO_AJUSTE_NO_HISTORICO = {
  propor: "Propôs o ajuste da pontuação",
  aprovar: "Aprovou o ajuste da pontuação",
  cancelar: "Cancelou o ajuste da pontuação",
};

const ACOES_DA_RESPOSTA_NO_HISTORICO = {
  criacao: "Criou o rascunho da resposta",
  enviar_revisao: "Enviou a resposta para revisão",
  aprovar: "Aprovou a resposta",
  devolver: "Devolveu a resposta",
  reabrir: "Reabriu a resposta",
  marcar_enviada: "Marcou a resposta como enviada",
};

function textoDoHistorico(h, origens) {
  if (h.acao === "criacao") return "Cadastrou o recurso";
  if (h.acao === "anexo")
    return h.campo === "arquivamento"
      ? `Arquivou o anexo ${h.anterior || ""}${h.motivo ? `: ${h.motivo}` : ""}`
      : `Anexou ${h.novo || "um arquivo"}`;
  if (h.acao === "resposta") {
    const texto =
      ACOES_DA_RESPOSTA_NO_HISTORICO[h.campo] ||
      `Resposta: ${rotuloDoEstado(h.novo).toLowerCase()}`;
    return `${texto}${h.motivo ? `: ${h.motivo}` : ""}`;
  }
  if (h.acao === "parecer") {
    const texto =
      ACOES_DO_PARECER_NO_HISTORICO[h.campo] ||
      `Situação: ${rotuloDaSituacao(h.novo)}`;
    return `${texto}${h.motivo ? `: ${h.motivo}` : ""}`;
  }
  if (h.acao === "ajuste") {
    const texto =
      ACOES_DO_AJUSTE_NO_HISTORICO[h.campo] || "Ajuste da pontuação";
    return `${texto}${h.motivo ? `: ${h.motivo}` : ""}`;
  }
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

export function GavetaDoRecurso({
  estado,
  recurso: r,
  detalhe,
  origens,
  podeEditar,
  podeDecidir = false,
  modelos = [],
  area = "",
}) {
  // Recurso decidido: excluir é do parecer jurídico. A etapa "resposta
  // enviada" é de quem edita, mas só marca com o recurso decidido.
  const podeExcluir = podeEditar && (!r.decidido || podeDecidir);
  const podeMarcar = (etapa) =>
    etapa.id === "resposta_candidato"
      ? podeEditar && (r.decidido || r.etapas[etapa.id])
      : podeEditar;
  const { acao } = useSyncExternalStore(estado.assinar, estado.obter);
  const resposta = detalhe?.resposta;
  const [excluindo, setExcluindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const carregando = !detalhe;
  const erro = detalhe?.erro;
  const prazo = detalheDoPrazo(r);

  return (
    <Gaveta
      id="recursosGaveta"
      tituloId="recursosGavetaTitulo"
      aoFechar={estado.fecharGaveta}
      className="recursos-gaveta"
      sobretitulo={`Recurso nº ${r.nu} · ${rotuloDaOrigem(r.origem, origens)}`}
      titulo={r.candidato}
      rotuloDoFechar="Fechar detalhe"
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
    >
      <div className="ui-gaveta-contexto">
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

      <div className="ui-gaveta-corpo">
        <div className="recursos-corpo">
          {podeEditar && !excluindo ? (
            <div className="ui-acoes">
              <button
                type="button"
                className="btn small"
                disabled={Boolean(acao)}
                onClick={() => estado.abrirEdicao(r.id)}
              >
                <i className="fa-solid fa-pen-to-square" aria-hidden="true" />{" "}
                Editar
              </button>
              {podeExcluir ? (
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={Boolean(acao)}
                  onClick={() => setExcluindo(true)}
                >
                  <i className="fa-solid fa-trash" aria-hidden="true" /> Excluir
                </button>
              ) : null}
            </div>
          ) : null}

          <SecaoDoParecer
            key={`${r.id}:${r.revisao}`}
            estado={estado}
            recurso={r}
            detalhe={detalhe}
            podeEditar={podeEditar}
            podeDecidir={podeDecidir}
            acao={acao}
          />

          <SecaoDoAjuste estado={estado} recurso={r} acao={acao} />

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
                        disabled={!podeMarcar(etapa) || Boolean(acao)}
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

          {erro ? null : (
            <SecaoDaResposta
              key={
                resposta
                  ? `${resposta.id}:${resposta.revisao}`
                  : detalhe
                    ? "nova"
                    : "carregando"
              }
              estado={estado}
              recurso={r}
              detalhe={detalhe}
              modelos={modelos}
              origens={origens}
              area={area}
              podeEditar={podeEditar}
              podeDecidir={podeDecidir}
              acao={acao}
            />
          )}

          <SecaoDeAnexos
            estado={estado}
            recurso={r}
            detalhe={detalhe}
            podeEditar={podeEditar}
            acao={acao}
          />

          {r.fora_analise ? null : (
            <Secao
              icone="fa-chart-simple"
              titulo="Resultado da análise"
              secao="result"
            >
              <div className="ui-kv-grade">
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
            <div className="ui-kv-grade">
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
            <div className="ui-kv-grade">
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
              <Aviso
                como="p"
                className="recursos-aviso"
                tom={r.prazo.data ? "info" : "warning"}
              >
                <i className="fa-solid fa-circle-info" aria-hidden="true" />{" "}
                {r.prazo.aviso}
              </Aviso>
            ) : null}
          </Secao>

          <Secao icone="fa-circle-info" titulo="Observação" secao="observacao">
            <div className="ui-secao-texto">
              {carregando ? (
                "Carregando…"
              ) : detalhe?.observacao ? (
                detalhe.observacao
              ) : (
                <span className="ui-secao-vazio">Sem observação.</span>
              )}
            </div>
          </Secao>

          <Secao
            icone="fa-clock-rotate-left"
            titulo="Histórico"
            secao="historico"
          >
            {erro ? (
              <Aviso como="p" className="recursos-aviso" tom="danger">
                Não foi possível carregar o histórico. <small>{erro}</small>
              </Aviso>
            ) : carregando ? (
              <Carregando className="ui-secao-texto" />
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

          {podeExcluir && excluindo ? (
            <form
              className="recursos-bloco recursos-exclusao"
              onSubmit={(evento) => {
                evento.preventDefault();
                void estado.excluir(r.id, motivo.trim());
              }}
            >
              <div className="ui-campo">
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
              <div className="ui-acoes">
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
    </Gaveta>
  );
}
