import { useRef, useState, useSyncExternalStore } from "react";
import {
  errosDoModelo,
  MARCADORES,
  MODELO_VAZIO,
  rascunhoDoModelo,
} from "../../lib/modelos-de-resposta.js";
import {
  rotuloDaOrigem,
  rotuloDaSituacao,
  SITUACOES,
} from "../../lib/recursos-dos-candidatos.js";
import { Modal } from "../modal.jsx";
import { dataHora, Secao, TopoDaGaveta } from "./partes.jsx";

/*
  "Modelos de resposta" (só para quem administra Recursos, nível admin), na
  gaveta do painel. A lista mostra a versão vigente de cada modelo (ativos
  primeiro); editar grava a versão seguinte e a anterior continua guardada,
  porque as respostas citam a versão que usaram. Arquivar pede motivo; salvar
  um arquivado o reativa numa versão nova. Os marcadores entram no texto pelo
  botão (no cursor); o banco recusa marcador fora da lista.
*/

const SITUACOES_DO_MODELO = SITUACOES.filter((s) => s.id !== "EM_ANALISE");

function FormularioDoModelo({ estado, modelo, dados, acao, aoFechar }) {
  const [rascunho, setRascunho] = useState(() => rascunhoDoModelo(modelo));
  const [tentou, setTentou] = useState(false);
  const texto = useRef(null);
  const erros = errosDoModelo(rascunho);
  const erro = (campo) => (tentou ? erros[campo] : "");
  const mudar = (campo, valor) =>
    setRascunho((atual) => ({ ...atual, [campo]: valor }));

  function inserirMarcador(chave) {
    const campo = texto.current;
    const marcador = `{${chave}}`;
    const inicio = campo?.selectionStart ?? rascunho.corpo.length;
    const fim = campo?.selectionEnd ?? rascunho.corpo.length;
    const novo =
      rascunho.corpo.slice(0, inicio) + marcador + rascunho.corpo.slice(fim);
    mudar("corpo", novo);
    requestAnimationFrame(() => {
      campo?.focus();
      campo?.setSelectionRange(
        inicio + marcador.length,
        inicio + marcador.length,
      );
    });
  }

  return (
    <form
      className="detail-block recursos-formulario recursos-modelo-form"
      onSubmit={async (evento) => {
        evento.preventDefault();
        setTentou(true);
        if (Object.keys(erros).length) return;
        const resultado = await estado.salvarModelo(rascunho);
        if (resultado?.ok) aoFechar();
      }}
    >
      <strong>
        {rascunho.id
          ? `Editar “${modelo.nome}” (grava a versão ${Number(rascunho.versao) + 1})`
          : "Novo modelo"}
      </strong>
      <div className="recursos-formulario-grade">
        <div className="field recursos-campo-largo">
          <label htmlFor="recursosModeloNome">Nome</label>
          <input
            id="recursosModeloNome"
            name="nome"
            value={rascunho.nome}
            maxLength={150}
            data-foco-inicial
            onChange={(evento) => mudar("nome", evento.target.value)}
          />
          {erro("nome") ? (
            <small className="recursos-erro-campo">{erro("nome")}</small>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="recursosModeloSituacao">Situação</label>
          <select
            id="recursosModeloSituacao"
            name="situacao"
            value={rascunho.situacao}
            onChange={(evento) => mudar("situacao", evento.target.value)}
          >
            {SITUACOES_DO_MODELO.map((s) => (
              <option key={s.id} value={s.id}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="recursosModeloOrigem">Origem</label>
          <select
            id="recursosModeloOrigem"
            name="origem"
            value={rascunho.origem}
            onChange={(evento) => mudar("origem", evento.target.value)}
          >
            <option value="">Todas as origens</option>
            {(dados.origens || []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="recursosModeloArea">Área</label>
          <select
            id="recursosModeloArea"
            name="area"
            value={rascunho.area}
            onChange={(evento) => mudar("area", evento.target.value)}
          >
            <option value="">Todas as áreas</option>
            {(dados.areas || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="field recursos-campo-largo">
          <label htmlFor="recursosModeloCorpo">Texto do modelo</label>
          <div
            className="recursos-marcadores"
            role="group"
            aria-label="Inserir marcador"
          >
            {MARCADORES.map((m) => (
              <button
                key={m.chave}
                type="button"
                className="chip-filter"
                title={m.rotulo}
                onClick={() => inserirMarcador(m.chave)}
              >
                {`{${m.chave}}`}
              </button>
            ))}
          </div>
          <textarea
            id="recursosModeloCorpo"
            ref={texto}
            name="corpo"
            rows={14}
            maxLength={20000}
            value={rascunho.corpo}
            onChange={(evento) => mudar("corpo", evento.target.value)}
          />
          {erro("corpo") ? (
            <small className="recursos-erro-campo">{erro("corpo")}</small>
          ) : null}
        </div>
      </div>
      <div className="detail-actions">
        <button
          type="button"
          className="btn secondary small"
          onClick={aoFechar}
        >
          Cancelar
        </button>
        <button type="submit" className="btn small" disabled={Boolean(acao)}>
          {acao?.tipo === "modelo:salvar" ? acao.rotulo : "Salvar modelo"}
        </button>
      </div>
    </form>
  );
}

function CartaoDoModelo({ estado, modelo, dados, acao, aoEditar }) {
  const [arquivando, setArquivando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const area =
    (dados.areas || []).find((a) => a.id === modelo.area)?.rotulo ||
    modelo.area;
  return (
    <li className="recursos-modelo" data-ativo={modelo.ativo || undefined}>
      <div className="recursos-anexo-linha">
        <span className="recursos-anexo-nome">
          <b>{modelo.nome}</b>
          <small>
            {[
              rotuloDaSituacao(modelo.situacao),
              modelo.origem
                ? rotuloDaOrigem(modelo.origem, dados.origens)
                : "Todas as origens",
              area || "Todas as áreas",
              `versão ${modelo.versao}`,
              modelo.em_uso ? `${modelo.em_uso} resposta(s)` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </small>
          {!modelo.ativo ? (
            <small>
              Arquivado{" "}
              {[dataHora(modelo.arquivado_em), modelo.arquivado_por]
                .filter(Boolean)
                .join(" · ")}
              {modelo.motivo_arquivamento
                ? `: ${modelo.motivo_arquivamento}`
                : ""}
            </small>
          ) : null}
        </span>
        <span className="detail-actions">
          <button
            type="button"
            className="btn secondary small"
            disabled={Boolean(acao)}
            onClick={aoEditar}
          >
            {modelo.ativo ? "Editar" : "Editar e reativar"}
          </button>
          {modelo.ativo && !arquivando ? (
            <button
              type="button"
              className="btn secondary small"
              disabled={Boolean(acao)}
              onClick={() => setArquivando(true)}
            >
              Arquivar
            </button>
          ) : null}
        </span>
      </div>
      {arquivando ? (
        <form
          className="recursos-anexo-arquivar"
          onSubmit={async (evento) => {
            evento.preventDefault();
            const ok = await estado.arquivarModelo(modelo.id, motivo.trim());
            if (ok) setArquivando(false);
          }}
        >
          <div className="field">
            <label htmlFor={`recursosMotivoModelo-${modelo.id}`}>
              Motivo do arquivamento
            </label>
            <input
              id={`recursosMotivoModelo-${modelo.id}`}
              name="motivo"
              value={motivo}
              minLength={3}
              maxLength={500}
              required
              data-foco-inicial
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          </div>
          <div className="detail-actions">
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setArquivando(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn danger small"
              disabled={motivo.trim().length < 3 || Boolean(acao)}
            >
              Arquivar modelo
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

export function PainelDeModelos({ estado }) {
  const { modelosAdmin: dados, acao } = useSyncExternalStore(
    estado.assinar,
    estado.obter,
  );
  // `null`: lista; `MODELO_VAZIO`: novo; um modelo: edição.
  const [editando, setEditando] = useState(null);
  const modelos = dados?.modelos || [];

  return (
    <Modal
      id="recursosModelos"
      rotuloId="recursosModelosTitulo"
      aoFechar={estado.fecharModelos}
      className="analises-drawer-backdrop recursos-gaveta"
      cartaoClassName="analises-drawer"
    >
      <TopoDaGaveta
        sobretitulo="Administração de Recursos"
        titulo="Modelos de resposta"
        tituloId="recursosModelosTitulo"
        rotuloDoFechar="Fechar modelos de resposta"
        aoFechar={estado.fecharModelos}
        resumo={
          <span>
            <i className="fa-solid fa-code-branch" aria-hidden="true" />
            Editar grava uma versão nova; as respostas guardam a versão usada.
          </span>
        }
      />
      <div id="analisesDrawerBody">
        <div className="detail-shell">
          {!dados ? (
            <div className="analises-detail-analysis">Carregando…</div>
          ) : dados.erro ? (
            <p className="recursos-aviso" data-tone="danger">
              Não foi possível carregar os modelos. <small>{dados.erro}</small>
            </p>
          ) : editando ? (
            <FormularioDoModelo
              key={editando.id || "novo"}
              estado={estado}
              modelo={editando.id ? editando : null}
              dados={dados}
              acao={acao}
              aoFechar={() => setEditando(null)}
            />
          ) : (
            <>
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn small"
                  disabled={Boolean(acao)}
                  onClick={() => setEditando(MODELO_VAZIO)}
                >
                  <i className="fa-solid fa-plus" aria-hidden="true" /> Novo
                  modelo
                </button>
              </div>
              <Secao
                icone="fa-file-lines"
                titulo={`${modelos.length} modelo${modelos.length === 1 ? "" : "s"}`}
                secao="modelos"
              >
                <ul className="recursos-lista-de-anexos">
                  {modelos.map((m) => (
                    <CartaoDoModelo
                      key={m.id}
                      estado={estado}
                      modelo={m}
                      dados={dados}
                      acao={acao}
                      aoEditar={() => setEditando(m)}
                    />
                  ))}
                </ul>
              </Secao>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
