import { useMemo, useState, useSyncExternalStore } from "react";
import {
  camposUsados,
  emissaoInicial,
  modelosParaEmitir,
  validarEmissao,
} from "../../../lib/carta-de-convocacao.js";
import { formatarData } from "../../../lib/lista-aprovados-rules.js";
import {
  Aviso,
  BlocosEsqueleto,
  BotaoDeAcao,
  Campo,
  Modal,
  Segmentado,
} from "../../../ui/index.js";

/*
  Emitir a carta de convocação para um ou vários candidatos (escolhidos na aba
  Convocação ou pela linha/gaveta do candidato): o modelo (os do edital
  primeiro), os valores desta emissão que o modelo usa (data limite, local,
  documentos, contato — começam com os da versão vigente), um documento com
  todas ou uma carta por candidato, a prévia "Como fica no SEI" e as saídas:
  Copiar para o SEI, DOCX (ZIP com uma por candidato) e PDF. A primeira saída
  registra a emissão; depois dela, a tela oferece marcar como Convocado quem
  está sem status (ou já convocado), com a data.
*/

const AGRUPAMENTOS = [
  { valor: "UNICO", rotulo: "Um documento com todas" },
  { valor: "POR_CANDIDATO", rotulo: "Uma carta por candidato" },
];

const CAMPOS_DA_EMISSAO = [
  ["DATA_LIMITE", "dataLimite", "Data limite"],
  ["LOCAL", "local", "Local de apresentação"],
  ["CONTATO", "contato", "Contato para dúvidas"],
  ["DOCUMENTOS", "documentos", "Documentos (um por linha)"],
];

const marcaveis = (candidatos) =>
  candidatos.filter((c) => !c.status || c.status === "Convocado");

function Emitida({ estado, emissao, candidatos, hoje }) {
  const [data, setData] = useState(hoje);
  const [marcado, setMarcado] = useState(null);
  const daEmissao = candidatos.filter((c) =>
    emissao.candidatos.some((e) => e.candidato_id === c.candidato_id),
  );
  const quem = marcaveis(daEmissao);
  if (marcado)
    return (
      <Aviso tom="info" className="carta-emitida" papel="status">
        {marcado.marcados} marcado(s) como Convocado em {formatarData(data)}.
      </Aviso>
    );
  return (
    <Aviso tom="info" className="carta-emitida">
      <strong>Carta registrada.</strong>{" "}
      {quem.length ? (
        <span className="carta-marcar">
          <label htmlFor="cartaDataConvocacao">
            Marcar{" "}
            {quem.length === 1 ? quem[0].nome : `${quem.length} candidatos`}{" "}
            como Convocado em
          </label>
          <input
            id="cartaDataConvocacao"
            type="date"
            max={hoje}
            value={data}
            onChange={(evento) => setData(evento.target.value)}
          />
          <BotaoDeAcao
            estado={estado}
            acao="marcar-convocados"
            id="cartaMarcarConvocados"
            data-tour="aprovados-carta-marcar-convocados"
            className="btn green small"
            onClick={async () => {
              const resultado = await estado.carta.marcar(
                quem,
                data,
                emissao.cartaId,
              );
              if (resultado) setMarcado(resultado);
            }}
          >
            Marcar como Convocado
          </BotaoDeAcao>
        </span>
      ) : (
        "Todos já têm status: nenhum a marcar como Convocado."
      )}
    </Aviso>
  );
}

export function ModalDaCarta({
  estado,
  candidatos: iniciais,
  podeEditarModelos,
}) {
  const carta = useSyncExternalStore(estado.carta.assinar, estado.carta.obter);
  const hoje = estado.carta.hoje();
  const [candidatos, setCandidatos] = useState(iniciais);
  const opcoes = useMemo(
    () => modelosParaEmitir(carta.modelos, candidatos),
    [carta.modelos, candidatos],
  );
  const [modeloId, setModeloId] = useState("");
  const modelo = opcoes.find((m) => m.id === modeloId) || opcoes[0] || null;
  const [valores, setValores] = useState({});
  const emissao = valores[modelo?.id] || emissaoInicial(modelo, hoje);
  const [agrupamento, setAgrupamento] = useState("UNICO");
  const [indice, setIndice] = useState(0);
  const [emitida, setEmitida] = useState(null);
  const fechar = estado.fecharModal;

  const usados = modelo
    ? camposUsados(modelo.vigente.titulo, modelo.vigente.texto)
    : [];
  const { erros, avisos } = validarEmissao({
    modelo: modelo?.vigente,
    candidatos,
    emissao,
    hoje,
  });
  const porCandidato = agrupamento === "POR_CANDIDATO" && candidatos.length > 1;
  const atual = Math.min(indice, candidatos.length - 1);
  const doc = modelo
    ? estado.carta.documento({
        modelo,
        candidatos: porCandidato ? [candidatos[atual]] : candidatos,
        emissao,
      })
    : null;
  const pagina = estado.carta.paginaDe(doc);

  const mudar = (campo, valor) =>
    setValores((atuais) => ({
      ...atuais,
      [modelo.id]: { ...emissao, [campo]: valor },
    }));

  async function emitir(saida) {
    const resultado = await estado.carta.emitir({
      modelo,
      candidatos,
      emissao,
      agrupamento: porCandidato ? "POR_CANDIDATO" : "UNICO",
      saida,
      indice: atual,
    });
    if (resultado) setEmitida(resultado);
  }

  const titulo =
    candidatos.length === 1
      ? candidatos[0].nome
      : `${candidatos.length} candidatos`;

  return (
    <Modal
      id="cartaModal"
      rotuloId="cartaTitulo"
      aoFechar={fechar}
      fecharAoClicarFora={false}
      cartaoClassName="carta-modal"
    >
      <div className="modal-head">
        <div>
          <h3 id="cartaTitulo">Carta de convocação</h3>
          <p className="approved-modal-subtitle" id="cartaSubtitulo">
            {titulo}
          </p>
        </div>
        <button className="btn secondary" type="button" onClick={fechar}>
          Fechar
        </button>
      </div>

      {carta.carregando && !carta.carregado ? (
        <div className="carta-corpo" aria-busy="true">
          <BlocosEsqueleto quantos={4} className="carta-esqueleto" />
        </div>
      ) : carta.erro && !carta.carregado ? (
        <Aviso tom="danger" papel="alert">
          Não foi possível ler os modelos da carta: {carta.erro}{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void estado.carta.carregarModelos({ forcar: true })}
          >
            Tentar de novo
          </button>
        </Aviso>
      ) : !opcoes.length ? (
        <div className="carta-sem-modelo">
          <p className="ui-vazio" id="cartaSemModelo">
            Nenhum modelo ativo para{" "}
            {candidatos.length === 1 ? "este candidato" : "estes candidatos"}.
          </p>
          {podeEditarModelos ? (
            <button
              type="button"
              className="btn green"
              id="cartaCriarModelo"
              data-tour="aprovados-carta-criar-modelo"
              onClick={estado.abrirModelosDaCarta}
            >
              <i className="fa-solid fa-file-pen" aria-hidden="true" /> Criar
              modelo
            </button>
          ) : null}
        </div>
      ) : (
        <div className="carta-corpo">
          <form
            className="carta-formulario"
            aria-label="Dados da emissão"
            data-tour="aprovados-carta-campos"
            onSubmit={(evento) => evento.preventDefault()}
          >
            <Campo rotulo="Modelo">
              <select
                id="cartaModelo"
                data-tour="aprovados-carta-modelo"
                data-foco-inicial
                value={modelo.id}
                onChange={(evento) => {
                  setModeloId(evento.target.value);
                  setEmitida(null);
                }}
              >
                {opcoes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} (v{m.versao}
                    {m.editalId ? ` · edital ${m.edital || ""}` : ""})
                  </option>
                ))}
              </select>
            </Campo>
            {CAMPOS_DA_EMISSAO.filter(([chave]) => usados.includes(chave)).map(
              ([chave, campo, rotulo]) => (
                <Campo key={chave} rotulo={rotulo}>
                  {chave === "DOCUMENTOS" ? (
                    <textarea
                      id="cartaDocumentos"
                      rows={5}
                      maxLength={5000}
                      value={emissao.documentos}
                      onChange={(evento) => mudar(campo, evento.target.value)}
                    />
                  ) : (
                    <input
                      id={`carta-${campo}`}
                      type={chave === "DATA_LIMITE" ? "date" : "text"}
                      min={chave === "DATA_LIMITE" ? hoje : undefined}
                      maxLength={chave === "DATA_LIMITE" ? undefined : 500}
                      value={emissao[campo]}
                      onChange={(evento) => mudar(campo, evento.target.value)}
                    />
                  )}
                </Campo>
              ),
            )}
            {candidatos.length > 1 ? (
              <Segmentado
                rotulo="Como sai"
                className="carta-agrupamento"
                opcoes={AGRUPAMENTOS}
                valor={agrupamento}
                aoMudar={(valor) => {
                  setAgrupamento(valor);
                  setIndice(0);
                }}
              />
            ) : null}
            <ul className="carta-candidatos" aria-label="Candidatos da carta">
              {candidatos.map((c) => (
                <li key={c.candidato_id}>
                  <span>{c.nome}</span>
                  {c.status ? <small>{c.status}</small> : null}
                  {candidatos.length > 1 ? (
                    <button
                      type="button"
                      className="approved-icone-acao"
                      title="Tirar da carta"
                      aria-label={`Tirar ${c.nome} da carta`}
                      onClick={() => {
                        setCandidatos((atuais) =>
                          atuais.filter(
                            (o) => o.candidato_id !== c.candidato_id,
                          ),
                        );
                        setIndice(0);
                      }}
                    >
                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
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
          </form>
          <div className="carta-previa" data-tour="aprovados-carta-previa">
            {porCandidato ? (
              <div className="carta-navegacao">
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={atual <= 0}
                  onClick={() => setIndice(atual - 1)}
                  aria-label="Carta anterior"
                >
                  <i className="fa-solid fa-chevron-left" aria-hidden="true" />
                </button>
                <span id="cartaNavegacao">
                  Carta {atual + 1} de {candidatos.length} ·{" "}
                  {candidatos[atual]?.nome}
                </span>
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={atual >= candidatos.length - 1}
                  onClick={() => setIndice(atual + 1)}
                  aria-label="Próxima carta"
                >
                  <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <iframe
              className="carta-previa-folha"
              id="cartaPrevia"
              title="Prévia da carta no SEI"
              sandbox=""
              srcDoc={pagina}
            />
          </div>
        </div>
      )}

      {emitida ? (
        <Emitida
          key={emitida.cartaId}
          estado={estado}
          emissao={emitida}
          candidatos={candidatos}
          hoje={hoje}
        />
      ) : null}

      {modelo && opcoes.length ? (
        <div
          className="ui-acoes carta-acoes"
          data-tour="aprovados-carta-emitir"
        >
          <BotaoDeAcao
            estado={estado.carta}
            acao="emitir-PDF"
            className="btn secondary"
            id="cartaPdf"
            disabled={Boolean(erros.length)}
            onClick={() => void emitir("PDF")}
          >
            <i className="fa-solid fa-file-pdf" aria-hidden="true" /> PDF
          </BotaoDeAcao>
          <BotaoDeAcao
            estado={estado.carta}
            acao="emitir-DOCX"
            className="btn secondary"
            id="cartaDocx"
            disabled={Boolean(erros.length)}
            onClick={() => void emitir("DOCX")}
          >
            <i className="fa-solid fa-file-word" aria-hidden="true" />{" "}
            {porCandidato ? "DOCX (um por candidato, .zip)" : "Baixar DOCX"}
          </BotaoDeAcao>
          <BotaoDeAcao
            estado={estado.carta}
            acao="emitir-SEI"
            className="btn"
            id="cartaCopiarSei"
            disabled={Boolean(erros.length)}
            onClick={() => void emitir("SEI")}
          >
            <i className="fa-solid fa-copy" aria-hidden="true" />{" "}
            {porCandidato
              ? "Copiar esta carta para o SEI"
              : "Copiar para o SEI"}
          </BotaoDeAcao>
        </div>
      ) : null}
    </Modal>
  );
}
