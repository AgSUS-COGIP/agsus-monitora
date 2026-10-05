import { useRef, useState, useSyncExternalStore } from "react";
import {
  CAMPOS_DA_CARTA,
  emissaoInicial,
  rascunhoDoModelo,
  validarModelo,
} from "../../../lib/carta-de-convocacao.js";
import { opcoesDeEdital } from "../../../lib/lista-aprovados-rules.js";
import { formatarDataHora } from "../../../lib/cronograma-do-edital.js";
import {
  Aviso,
  BlocosEsqueleto,
  BotaoDeAcao,
  Campo,
  Modal,
  Selo,
} from "../../../ui/index.js";

/*
  Os modelos da carta de convocação da área: a lista (ativos primeiro; os de
  um edital dizem qual), o editor — nome, edital (só ao criar), título, texto
  com os campos entre chaves, os valores padrão de local, documentos, contato
  e prazo, e o motivo a partir da 2ª versão — com a prévia num candidato da
  área, as versões salvas e inativar/reativar com motivo. Quem lê vê os
  modelos e as versões; quem edita (aprovados >= editor) muda.
*/

function Versoes({ modelo }) {
  if (!modelo.versoes.length) return null;
  return (
    <details className="carta-versoes">
      <summary>Versões ({modelo.versoes.length})</summary>
      <ol>
        {modelo.versoes.map((v) => (
          <li key={v.versao}>
            <strong>v{v.versao}</strong> · {formatarDataHora(v.salvoEm)}
            {v.usuario ? ` · ${v.usuario}` : ""}
            {v.motivo ? <small> — {v.motivo}</small> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function MudarSituacao({ estado, modelo }) {
  const [abrindo, setAbrindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const rotulo = modelo.ativo ? "Inativar" : "Reativar";
  if (!abrindo)
    return (
      <button
        type="button"
        className="btn secondary small"
        data-modelo-action="situacao"
        onClick={() => setAbrindo(true)}
      >
        {rotulo}
      </button>
    );
  return (
    <span className="carta-situacao">
      <input
        aria-label={`Motivo para ${rotulo.toLowerCase()} ${modelo.nome}`}
        placeholder="Motivo"
        maxLength={500}
        value={motivo}
        onChange={(evento) => setMotivo(evento.target.value)}
      />
      <BotaoDeAcao
        estado={estado.carta}
        acao="situacao-modelo-carta"
        className="btn small"
        data-modelo-action="confirmar-situacao"
        disabled={motivo.trim().length < 3}
        onClick={async () => {
          if (await estado.carta.definirAtivo(modelo, !modelo.ativo, motivo))
            setAbrindo(false);
        }}
      >
        {rotulo}
      </BotaoDeAcao>
      <button
        type="button"
        className="btn secondary small"
        onClick={() => setAbrindo(false)}
      >
        Cancelar
      </button>
    </span>
  );
}

function Editor({ estado, modelo, listas, exemplo, aoVoltar }) {
  const [rascunho, setRascunho] = useState(() => rascunhoDoModelo(modelo));
  const texto = useRef(null);
  const editando = Boolean(modelo);
  const { erros, avisos } = validarModelo(rascunho, {
    versaoAtual: modelo?.versao || 0,
  });
  const mudar = (campo, valor) =>
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
  const comoModelo = {
    id: modelo?.id || "novo",
    nome: rascunho.nome,
    versao: modelo?.versao || 1,
    vigente: {
      titulo: rascunho.titulo,
      texto: rascunho.texto,
      local: rascunho.local,
      documentos: rascunho.documentos,
      contato: rascunho.contato,
      prazoDias: rascunho.prazoDias,
    },
  };
  const pagina = exemplo
    ? estado.carta.paginaDe(
        estado.carta.documento({
          modelo: comoModelo,
          candidatos: [exemplo],
          emissao: emissaoInicial(comoModelo, estado.carta.hoje()),
        }),
      )
    : "";

  /* Põe o campo onde está o cursor do texto (ou no fim). */
  function inserir(chave) {
    const campo = texto.current;
    const marca = `{${chave}}`;
    const valor = rascunho.texto;
    const inicio = campo?.selectionStart ?? valor.length;
    const fim = campo?.selectionEnd ?? valor.length;
    mudar("texto", valor.slice(0, inicio) + marca + valor.slice(fim));
    requestAnimationFrame(() => {
      campo?.focus();
      campo?.setSelectionRange(inicio + marca.length, inicio + marca.length);
    });
  }

  async function salvar() {
    const id = await estado.carta.salvarModelo(rascunho, modelo);
    if (id) aoVoltar();
  }

  return (
    <div className="carta-editor">
      <form
        className="carta-formulario"
        aria-label={editando ? `Editar ${modelo.nome}` : "Novo modelo"}
        onSubmit={(evento) => evento.preventDefault()}
      >
        <div className="ui-grade-de-campos">
          <Campo rotulo="Nome do modelo" obrigatorio>
            <input
              id="cartaModeloNome"
              data-foco-inicial
              maxLength={120}
              value={rascunho.nome}
              onChange={(evento) => mudar("nome", evento.target.value)}
            />
          </Campo>
          {editando ? (
            <Campo rotulo="Vale para">
              <input
                id="cartaModeloEscopo"
                readOnly
                value={
                  modelo.editalId
                    ? `Edital ${modelo.edital}${modelo.unidade ? ` · ${modelo.unidade}` : ""}`
                    : "Todos os editais da área"
                }
              />
            </Campo>
          ) : (
            <Campo rotulo="Vale para">
              <select
                id="cartaModeloEdital"
                value={rascunho.editalId}
                onChange={(evento) => mudar("editalId", evento.target.value)}
              >
                <option value="">Todos os editais da área</option>
                {opcoesDeEdital(listas).map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
        <Campo rotulo="Título" obrigatorio>
          <input
            id="cartaModeloTitulo"
            maxLength={300}
            value={rascunho.titulo}
            onChange={(evento) => mudar("titulo", evento.target.value)}
          />
        </Campo>
        <Campo rotulo="Texto (um parágrafo por linha; **negrito**)" obrigatorio>
          <textarea
            id="cartaModeloTexto"
            ref={texto}
            rows={12}
            maxLength={20000}
            value={rascunho.texto}
            onChange={(evento) => mudar("texto", evento.target.value)}
          />
        </Campo>
        <div
          className="carta-campos"
          role="group"
          aria-label="Inserir campo no texto"
        >
          {CAMPOS_DA_CARTA.map((campo) => (
            <button
              key={campo.chave}
              type="button"
              className="carta-campo"
              title={campo.rotulo}
              data-campo={campo.chave}
              onClick={() => inserir(campo.chave)}
            >
              {`{${campo.chave}}`}
            </button>
          ))}
        </div>
        <div className="ui-grade-de-campos">
          <Campo rotulo="Local padrão">
            <input
              id="cartaModeloLocal"
              maxLength={500}
              value={rascunho.local}
              onChange={(evento) => mudar("local", evento.target.value)}
            />
          </Campo>
          <Campo rotulo="Contato padrão">
            <input
              id="cartaModeloContato"
              maxLength={500}
              value={rascunho.contato}
              onChange={(evento) => mudar("contato", evento.target.value)}
            />
          </Campo>
          <Campo rotulo="Prazo padrão (dias corridos)">
            <input
              id="cartaModeloPrazo"
              inputMode="numeric"
              maxLength={2}
              value={rascunho.prazoDias}
              onChange={(evento) => mudar("prazoDias", evento.target.value)}
            />
          </Campo>
        </div>
        <Campo rotulo="Documentos padrão (um por linha)">
          <textarea
            id="cartaModeloDocumentos"
            rows={5}
            maxLength={5000}
            value={rascunho.documentos}
            onChange={(evento) => mudar("documentos", evento.target.value)}
          />
        </Campo>
        {editando ? (
          <Campo
            rotulo={`Motivo da alteração (versão ${modelo.versao + 1})`}
            obrigatorio
          >
            <input
              id="cartaModeloMotivo"
              maxLength={500}
              value={rascunho.motivo}
              onChange={(evento) => mudar("motivo", evento.target.value)}
            />
          </Campo>
        ) : null}
        {erros.length ? (
          <Aviso tom="danger" papel="alert" className="carta-pendencias">
            <ul>
              {erros.map((erro) => (
                <li key={erro}>{erro}</li>
              ))}
            </ul>
          </Aviso>
        ) : null}
        {avisos.length ? (
          <Aviso tom="warning" className="carta-pendencias">
            <ul>
              {avisos.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
          </Aviso>
        ) : null}
        <div className="ui-acoes">
          <button type="button" className="btn secondary" onClick={aoVoltar}>
            Voltar
          </button>
          <BotaoDeAcao
            estado={estado.carta}
            acao="salvar-modelo-carta"
            className="btn green"
            id="cartaModeloSalvar"
            disabled={Boolean(erros.length)}
            onClick={() => void salvar()}
          >
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" />{" "}
            {editando ? "Salvar nova versão" : "Criar modelo"}
          </BotaoDeAcao>
        </div>
      </form>
      {pagina ? (
        <div className="carta-previa">
          <small className="carta-previa-exemplo">
            Prévia com {exemplo.nome}
          </small>
          <iframe
            className="carta-previa-folha"
            title="Prévia do modelo no SEI"
            sandbox=""
            srcDoc={pagina}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ModelosDaCarta({ estado, listas, candidatos }) {
  const carta = useSyncExternalStore(estado.carta.assinar, estado.carta.obter);
  const [editando, setEditando] = useState(null);
  const fechar = estado.fecharModal;
  const exemplo =
    candidatos.find((c) => c.lista_ativa) || candidatos[0] || null;
  const podeEditar = carta.podeEditar;

  return (
    <Modal
      id="cartaModelosModal"
      rotuloId="cartaModelosTitulo"
      aoFechar={fechar}
      fecharAoClicarFora={false}
      cartaoClassName="carta-modal"
    >
      <div className="modal-head">
        <div>
          <h3 id="cartaModelosTitulo">Modelos da carta de convocação</h3>
        </div>
        <button className="btn secondary" type="button" onClick={fechar}>
          Fechar
        </button>
      </div>
      {editando ? (
        <Editor
          key={
            editando === "novo" ? "novo" : `${editando.id}:${editando.versao}`
          }
          estado={estado}
          modelo={editando === "novo" ? null : editando}
          listas={listas}
          exemplo={exemplo}
          aoVoltar={() => setEditando(null)}
        />
      ) : carta.carregando && !carta.carregado ? (
        <div aria-busy="true">
          <BlocosEsqueleto quantos={3} className="carta-esqueleto" />
        </div>
      ) : carta.erro && !carta.carregado ? (
        <Aviso tom="danger" papel="alert">
          Não foi possível ler os modelos: {carta.erro}
        </Aviso>
      ) : (
        <div className="carta-modelos">
          {podeEditar ? (
            <div className="ui-acoes">
              <button
                type="button"
                className="btn green"
                id="cartaNovoModelo"
                data-foco-inicial
                onClick={() => setEditando("novo")}
              >
                <i className="fa-solid fa-plus" aria-hidden="true" /> Novo
                modelo
              </button>
            </div>
          ) : null}
          {carta.modelos.length ? (
            <ul className="carta-lista-de-modelos" id="cartaListaDeModelos">
              {carta.modelos.map((modelo) => (
                <li
                  key={modelo.id}
                  data-modelo={modelo.id}
                  data-ativo={modelo.ativo || undefined}
                >
                  <div className="carta-modelo-copy">
                    <strong>{modelo.nome}</strong>
                    <small>
                      v{modelo.versao} ·{" "}
                      {modelo.editalId
                        ? `Edital ${modelo.edital}${modelo.unidade ? ` · ${modelo.unidade}` : ""}`
                        : "Todos os editais da área"}
                      {" · "}
                      {modelo.cartas
                        ? `${modelo.cartas} carta${modelo.cartas === 1 ? "" : "s"} emitida${modelo.cartas === 1 ? "" : "s"}`
                        : "nenhuma carta emitida"}
                    </small>
                    {!modelo.ativo && modelo.motivoSituacao ? (
                      <small>Inativo: {modelo.motivoSituacao}</small>
                    ) : null}
                    <Versoes modelo={modelo} />
                  </div>
                  <div className="carta-modelo-acoes">
                    {modelo.ativo ? null : <Selo tom="neutro">Inativo</Selo>}
                    {podeEditar && modelo.ativo ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        data-modelo-action="editar"
                        onClick={() => setEditando(modelo)}
                      >
                        <i className="fa-solid fa-pen" aria-hidden="true" />{" "}
                        Editar
                      </button>
                    ) : null}
                    {podeEditar ? (
                      <MudarSituacao estado={estado} modelo={modelo} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-vazio" id="cartaSemModelos">
              Nenhum modelo nesta área.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
