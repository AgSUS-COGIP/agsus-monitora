import { useMemo, useState } from "react";
import {
  modelosAplicaveis,
  renderizarModelo,
  valoresDoRecurso,
  MARCADORES,
} from "../../lib/modelos-de-resposta.js";
import {
  acoesDaResposta,
  erroDoComentario,
  podeEditarTexto,
} from "../../lib/resposta-do-recurso.js";
import { Aviso, Kv, Secao } from "../../ui/index.js";
import { dataHora } from "./partes.jsx";
import { SeloDaResposta } from "./tabela.jsx";

/*
  "Resposta ao candidato", na gaveta do recurso: escolher o modelo (os da
  área, da origem e — com o recurso decidido — da situação), ver o texto com
  os marcadores preenchidos, escrever a fundamentação e salvar o rascunho; daí
  enviar para revisão (opcional), aprovar ou devolver com comentário, gerar o
  documento (impressão/PDF e .docx, que pode virar anexo) e marcar a resposta
  como enviada — o que marca também a etapa do recurso. Aprovar e devolver
  são do parecer jurídico: sem `podeDecidir`, os botões nem aparecem. Marcar
  enviada é de quem edita, só com o recurso decidido.

  O banco decide (transicionar_resposta_recurso); os botões seguem
  resposta-do-recurso.js só para dizer antes por que uma ação não vale. Tudo
  é texto: o preview e o texto final vão como filhos, nunca como HTML.

  A gaveta monta esta seção com `key` na revisão da resposta: quando o banco
  devolve uma revisão nova, o rascunho local recomeça do que foi salvo.
*/

const ROTULO_DO_HISTORICO = {
  criacao: "Criou o rascunho",
  edicao: "Editou o texto",
  enviar_revisao: "Enviou para revisão",
  aprovar: "Aprovou",
  devolver: "Devolveu para ajuste",
  reabrir: "Reabriu para edição",
  marcar_enviada: "Marcou como enviada ao candidato",
};

const chaveDoModelo = (id, versao) => (id ? `${id}:${versao}` : "");

function rascunhoInicial(resposta, aplicaveis, decidido) {
  if (resposta)
    return {
      modelo: {
        id: resposta.modelo_id,
        versao: resposta.modelo_versao,
        nome: resposta.modelo_nome,
        corpo: resposta.modelo_corpo || "",
        situacao: resposta.modelo_situacao,
      },
      fundamentacao: resposta.fundamentacao || "",
    };
  return {
    modelo: decidido && aplicaveis.length ? aplicaveis[0] : null,
    fundamentacao: "",
  };
}

/* Ação escolhida: comentário (quando a ação pede) e confirmação. */
function ConfirmarAcao({ escolhida, emCurso, aoConfirmar, aoCancelar }) {
  const [comentario, setComentario] = useState("");
  const erro = erroDoComentario(escolhida.acao, comentario);
  const pede = escolhida.comentario !== "nao";
  return (
    <form
      className="recursos-bloco recursos-confirmacao"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!erro) aoConfirmar(comentario.trim());
      }}
    >
      {pede ? (
        <div className="ui-campo">
          <label htmlFor="recursosComentarioDaResposta">
            {escolhida.comentario === "obrigatorio"
              ? escolhida.acao === "devolver"
                ? "O que precisa ser ajustado"
                : "Motivo"
              : "Comentário (opcional)"}
          </label>
          <textarea
            id="recursosComentarioDaResposta"
            name="comentario"
            rows={3}
            maxLength={2000}
            value={comentario}
            data-foco-inicial
            onChange={(evento) => setComentario(evento.target.value)}
          />
        </div>
      ) : (
        <Aviso como="p" className="recursos-aviso" tom="info">
          {escolhida.acao === "marcar_enviada"
            ? "Confirme que a resposta aprovada já foi enviada ao candidato."
            : `Confirmar: ${escolhida.rotulo.toLowerCase()}?`}
        </Aviso>
      )}
      <div className="ui-acoes">
        <button
          type="button"
          className="btn secondary small"
          onClick={aoCancelar}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className={`btn small${escolhida.acao === "devolver" ? " danger" : ""}`}
          disabled={Boolean(erro) || emCurso}
        >
          {emCurso ? "Salvando…" : escolhida.rotulo}
        </button>
      </div>
    </form>
  );
}

function AcoesDaResposta({ estado, recurso, resposta, acoes, acao }) {
  const [escolhida, setEscolhida] = useState(null);
  if (!acoes.length) return null;
  if (escolhida)
    return (
      <ConfirmarAcao
        escolhida={escolhida}
        emCurso={acao?.tipo === `resposta:${escolhida.acao}`}
        aoCancelar={() => setEscolhida(null)}
        aoConfirmar={(comentario) =>
          void estado.transicionarResposta(
            recurso.id,
            resposta,
            escolhida.acao,
            comentario,
          )
        }
      />
    );
  return (
    <div className="recursos-acoes-da-resposta">
      <div className="ui-acoes">
        {acoes.map((a) => (
          <button
            key={a.acao}
            type="button"
            className={`btn small${a.acao === "devolver" || a.acao === "reabrir" ? " secondary" : ""}`}
            disabled={!a.permitida || Boolean(acao)}
            title={a.permitida ? a.rotulo : a.motivo}
            data-acao={a.acao}
            onClick={() => setEscolhida(a)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {acoes
        .filter((a) => !a.permitida && a.motivo)
        .map((a) => (
          <small key={a.acao} className="recursos-motivo">
            {a.rotulo}: {a.motivo}
          </small>
        ))}
    </div>
  );
}

function Documento({ estado, recurso, resposta, podeEditar, acao }) {
  if (!["aprovada", "enviada"].includes(resposta?.estado)) return null;
  return (
    <div className="recursos-documento" aria-label="Documento da resposta">
      <strong>Documento</strong>
      <div className="ui-acoes">
        <button
          type="button"
          className="btn secondary small"
          onClick={() => estado.imprimirResposta(recurso, resposta)}
        >
          <i className="fa-solid fa-print" aria-hidden="true" /> Imprimir / PDF
        </button>
        <button
          type="button"
          className="btn secondary small"
          onClick={() => estado.baixarDocx(recurso, resposta)}
        >
          <i className="fa-solid fa-file-word" aria-hidden="true" /> Baixar
          .docx
        </button>
        {podeEditar ? (
          <button
            type="button"
            className="btn secondary small"
            disabled={Boolean(acao)}
            onClick={() => void estado.anexarDocx(recurso, resposta)}
          >
            <i className="fa-solid fa-paperclip" aria-hidden="true" />{" "}
            {acao?.tipo === "anexo:documento"
              ? acao.rotulo
              : "Anexar .docx ao recurso"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SecaoDaResposta({
  estado,
  recurso: r,
  detalhe,
  modelos,
  origens,
  area,
  podeEditar,
  podeDecidir = false,
  acao,
}) {
  const resposta = detalhe?.resposta || null;
  const eu = detalhe?.eu || null;
  const editavel = podeEditar && podeEditarTexto(resposta);
  const aplicaveis = useMemo(
    () => modelosAplicaveis(modelos, r, area),
    [modelos, r, area],
  );
  const [rascunho, setRascunho] = useState(() =>
    rascunhoInicial(resposta, aplicaveis, r.decidido),
  );
  const renderizado = useMemo(
    () =>
      rascunho.modelo
        ? renderizarModelo(
            rascunho.modelo.corpo,
            valoresDoRecurso(r, {
              origens,
              fundamentacao: rascunho.fundamentacao,
            }),
          )
        : null,
    [rascunho, r, origens],
  );
  const alterada =
    !resposta ||
    chaveDoModelo(rascunho.modelo?.id, rascunho.modelo?.versao) !==
      chaveDoModelo(resposta.modelo_id, resposta.modelo_versao) ||
    rascunho.fundamentacao !== (resposta.fundamentacao || "");
  const acoes = acoesDaResposta({
    resposta,
    eu,
    podeEditar,
    podeDecidir,
    situacao: r.situacao,
    alterada: editavel && Boolean(resposta) && alterada,
  });
  const salvando = acao?.tipo === "resposta:salvar";

  if (!detalhe) return null;
  if (!resposta && !podeEditar)
    return (
      <Secao
        icone="fa-envelope-open-text"
        titulo="Resposta ao candidato"
        secao="resposta"
      >
        <div className="ui-secao-texto">
          <span className="ui-secao-vazio">
            Nenhuma resposta escrita no sistema.
          </span>
        </div>
      </Secao>
    );

  // O modelo em uso pode não estar mais entre os aplicáveis (versão antiga,
  // arquivado ou a situação mudou): continua escolhível.
  const opcoes =
    rascunho.modelo &&
    !aplicaveis.some(
      (m) =>
        chaveDoModelo(m.id, m.versao) ===
        chaveDoModelo(rascunho.modelo.id, rascunho.modelo.versao),
    )
      ? [{ ...rascunho.modelo, emUso: true }, ...aplicaveis]
      : aplicaveis;

  return (
    <Secao
      icone="fa-envelope-open-text"
      titulo="Resposta ao candidato"
      secao="resposta"
    >
      <div className="recursos-resposta">
        {resposta ? (
          <div className="ui-kv-grade">
            <Kv rotulo="Estado">
              <SeloDaResposta estado={resposta.estado} />
            </Kv>
            <Kv rotulo="Modelo">
              {`${resposta.modelo_nome} · versão ${resposta.modelo_versao}${resposta.modelo_vigente ? "" : " (há versão mais nova)"}`}
            </Kv>
            <Kv rotulo="Texto por">
              {[resposta.autor, dataHora(resposta.atualizado_em)]
                .filter(Boolean)
                .join(" · ")}
            </Kv>
            {resposta.envio_revisao_em ? (
              <Kv rotulo="Enviada para revisão">
                {[
                  dataHora(resposta.envio_revisao_em),
                  resposta.envio_revisao_por,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Kv>
            ) : null}
            {resposta.revisor ? (
              <Kv rotulo="Revisão">
                {[resposta.revisor, dataHora(resposta.revisao_em)]
                  .filter(Boolean)
                  .join(" · ")}
              </Kv>
            ) : null}
            {resposta.enviada_em ? (
              <Kv rotulo="Enviada ao candidato">
                {[dataHora(resposta.enviada_em), resposta.enviada_por]
                  .filter(Boolean)
                  .join(" · ")}
              </Kv>
            ) : null}
          </div>
        ) : null}

        {resposta?.comentario_revisao ? (
          <Aviso
            como="p"
            className="recursos-aviso"
            tom={resposta.estado === "devolvida" ? "danger" : "info"}
          >
            <strong>
              {resposta.estado === "devolvida"
                ? "Ajuste pedido na revisão: "
                : "Comentário: "}
            </strong>
            {resposta.comentario_revisao}
          </Aviso>
        ) : null}

        {editavel ? (
          <form
            className="recursos-resposta-editor"
            onSubmit={(evento) => {
              evento.preventDefault();
              if (!rascunho.modelo || !renderizado) return;
              void estado.salvarResposta(r.id, {
                modelo_id: rascunho.modelo.id,
                modelo_versao: rascunho.modelo.versao,
                fundamentacao: rascunho.fundamentacao,
                texto_final: renderizado.texto,
                revisao: resposta?.revisao ?? null,
              });
            }}
          >
            <div className="ui-campo">
              <label htmlFor="recursosModeloDaResposta">
                Modelo de resposta
              </label>
              <select
                id="recursosModeloDaResposta"
                name="modelo"
                value={chaveDoModelo(
                  rascunho.modelo?.id,
                  rascunho.modelo?.versao,
                )}
                onChange={(evento) => {
                  const escolhido = opcoes.find(
                    (m) =>
                      chaveDoModelo(m.id, m.versao) === evento.target.value,
                  );
                  setRascunho((atual) => ({
                    ...atual,
                    modelo: escolhido || null,
                  }));
                }}
              >
                <option value="">
                  {opcoes.length
                    ? "Escolha o modelo"
                    : "Nenhum modelo para este recurso"}
                </option>
                {opcoes.map((m) => (
                  <option
                    key={chaveDoModelo(m.id, m.versao)}
                    value={chaveDoModelo(m.id, m.versao)}
                  >
                    {m.nome}
                    {m.emUso ? ` — versão ${m.versao} (em uso)` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-campo">
              <label htmlFor="recursosFundamentacao">Fundamentação</label>
              <textarea
                id="recursosFundamentacao"
                name="fundamentacao"
                rows={6}
                maxLength={20000}
                value={rascunho.fundamentacao}
                placeholder="Motivos da decisão"
                onChange={(evento) =>
                  setRascunho((atual) => ({
                    ...atual,
                    fundamentacao: evento.target.value,
                  }))
                }
              />
            </div>
            {renderizado ? <PreviaDoTexto renderizado={renderizado} /> : null}
            <div className="ui-acoes">
              <button
                type="submit"
                className="btn small"
                disabled={
                  !rascunho.modelo ||
                  !rascunho.modelo.corpo ||
                  !alterada ||
                  Boolean(acao)
                }
              >
                {salvando ? acao.rotulo : "Salvar rascunho"}
              </button>
            </div>
          </form>
        ) : resposta ? (
          <div
            className="recursos-texto-final"
            aria-label="Texto final da resposta"
          >
            {resposta.texto_final}
          </div>
        ) : null}

        {resposta && podeEditar ? (
          <AcoesDaResposta
            key={`${resposta.estado}:${resposta.revisao}`}
            estado={estado}
            recurso={r}
            resposta={resposta}
            acoes={acoes}
            acao={acao}
          />
        ) : null}

        <Documento
          estado={estado}
          recurso={r}
          resposta={resposta}
          podeEditar={podeEditar}
          acao={acao}
        />

        {resposta?.historico?.length ? (
          <details className="recursos-historico-resposta">
            <summary>Histórico da resposta</summary>
            <ol className="recursos-historico">
              {resposta.historico.map((h, indice) => (
                <li key={`${h.em}-${indice}`}>
                  <span>
                    {ROTULO_DO_HISTORICO[h.acao] || h.acao}
                    {h.comentario ? `: ${h.comentario}` : ""}
                  </span>
                  <small>
                    {dataHora(h.em)}
                    {h.autor ? ` · ${h.autor}` : ""}
                  </small>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </Secao>
  );
}

function PreviaDoTexto({ renderizado }) {
  const rotulo = (chave) =>
    MARCADORES.find((m) => m.chave === chave)?.rotulo || chave;
  return (
    <div className="recursos-previa">
      <strong>Prévia do texto</strong>
      {renderizado.faltando.length ? (
        <Aviso como="p" className="recursos-aviso" tom="warning">
          Sem valor no recurso: {renderizado.faltando.map(rotulo).join(", ")}.
        </Aviso>
      ) : null}
      {renderizado.desconhecidos.length ? (
        <Aviso como="p" className="recursos-aviso" tom="danger">
          Marcador desconhecido no modelo:{" "}
          {renderizado.desconhecidos.map((c) => `{${c}}`).join(", ")}.
        </Aviso>
      ) : null}
      <div className="recursos-texto-final" aria-label="Prévia da resposta">
        {renderizado.texto}
      </div>
    </div>
  );
}
