import { useRef, useState } from "react";
import {
  MAXIMO_DE_ANEXOS,
  formatarTamanho,
  problemaDosAnexos,
} from "../../lib/anexos-do-candidato.js";
import {
  STATUS_DO_CANDIDATO,
  canEditCandidateStatus,
  statusNeedsMatricula,
  uniqueCandidateCargos,
} from "../../lib/lista-aprovados-rules.js";
import { Modal } from "../modal.jsx";
import { BotaoDeAcao, IconeDePdf } from "./partes.jsx";

/*
  Os modais de status do candidato (com os anexos novos), dos anexos do
  candidato e de inclusão sub judice. Cada abertura é
  uma montagem nova (`key` = abertura), então o rascunho começa sempre do que
  está no banco. Salvar é do estado (`estado.js`), que fecha o modal quando
  dá certo e deixa os dados digitados na tela quando dá erro.
*/

function Cabecalho({ tituloId, titulo, subtitulo, subtituloId, aoFechar }) {
  return (
    <div className="modal-head">
      <div>
        <h3 id={tituloId}>{titulo}</h3>
        <p id={subtituloId} className="approved-modal-subtitle">
          {subtitulo}
        </p>
      </div>
      <button className="btn secondary" type="button" onClick={aoFechar}>
        Fechar
      </button>
    </div>
  );
}

const DICA_DOS_ANEXOS = "Aceito apenas no formato PDF de até 2 MB";

/*
  Os PDFs escolhidos ficam no rascunho do modal e só sobem ao salvar o status.
  Escolher de novo soma aos já escolhidos; o `input` é esvaziado a cada escolha
  para que o mesmo arquivo possa voltar depois de tirado da lista.

  O botão é o do app para arquivo (como "Escolher imagem" em Configurações):
  um `<label class="btn secondary">` com o `input` nativo escondido dentro. O
  `input` continua focável, e o foco dele aparece no botão.
*/
function CampoDeAnexos({ jaAnexados, arquivos, aoMudar }) {
  const entrada = useRef(null);
  const problema = problemaDosAnexos(arquivos, jaAnexados);
  const restam = Math.max(MAXIMO_DE_ANEXOS - jaAnexados - arquivos.length, 0);
  return (
    <div className="form-row full">
      <label htmlFor="approvedStatusAnexos">
        Anexar documentos{" "}
        <span
          className="approved-dica com-dica"
          data-dica={DICA_DOS_ANEXOS}
          aria-hidden="true"
        >
          <i className="fa-solid fa-circle-info" />
        </span>
      </label>
      <div className="approved-anexar-linha">
        <label
          className="btn secondary approved-anexar"
          aria-disabled={restam === 0 ? true : undefined}
        >
          <i className="fa-solid fa-file-arrow-up" aria-hidden="true" />
          <span>Fazer upload</span>
          <input
            ref={entrada}
            id="approvedStatusAnexos"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={restam === 0}
            aria-describedby="approvedAnexosDica approvedAnexosHint"
            aria-invalid={problema ? true : undefined}
            onChange={(evento) => {
              const novos = Array.from(evento.target.files ?? []);
              if (entrada.current) entrada.current.value = "";
              if (novos.length) aoMudar([...arquivos, ...novos]);
            }}
          />
        </label>
        <small id="approvedAnexosHint" className="approved-field-hint">
          {jaAnexados + arquivos.length} de {MAXIMO_DE_ANEXOS} anexos
        </small>
      </div>
      <span id="approvedAnexosDica" className="sr-only">
        {DICA_DOS_ANEXOS}
      </span>
      {problema ? (
        <small className="approved-field-erro" role="alert">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />{" "}
          {problema}
        </small>
      ) : null}
      {arquivos.length ? (
        <ul className="approved-anexos-escolhidos">
          {arquivos.map((arquivo, indice) => (
            <li key={`${arquivo.name}-${indice}`}>
              <span className="approved-anexo-icone">
                <IconeDePdf />
              </span>
              <span className="approved-anexo-nome">{arquivo.name}</span>
              <small>{formatarTamanho(arquivo.size)}</small>
              <button
                type="button"
                className="approved-icone-acao"
                title="Tirar da lista"
                aria-label={`Tirar ${arquivo.name} da lista`}
                onClick={() =>
                  aoMudar(arquivos.filter((_, outro) => outro !== indice))
                }
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ModalDeStatus({ estado, candidato, jaAnexados = 0 }) {
  const [status, setStatus] = useState(candidato.status || "");
  const [processo, setProcesso] = useState(candidato.processo_sei || "");
  const [matricula, setMatricula] = useState(candidato.matricula || "");
  const [anexos, setAnexos] = useState([]);
  const exigeMatricula = statusNeedsMatricula(status);
  const anexosInvalidos = Boolean(problemaDosAnexos(anexos, jaAnexados));
  const fechar = estado.fecharModal;

  return (
    <Modal
      id="approvedStatusModal"
      className="approved-modal"
      cartaoClassName="approved-modal-card"
      rotuloId="approvedStatusTitle"
      aoFechar={fechar}
    >
      <Cabecalho
        tituloId="approvedStatusTitle"
        titulo="Alterar status do candidato"
        subtituloId="approvedStatusCandidate"
        subtitulo={`${candidato.nome} · ${candidato.cargo}`}
        aoFechar={fechar}
      />
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-row full">
            <label htmlFor="approvedStatusSelect">Status</label>
            <select
              id="approvedStatusSelect"
              data-foco-inicial
              value={status}
              onChange={(evento) => setStatus(evento.target.value)}
            >
              <option value="">Sem status</option>
              {STATUS_DO_CANDIDATO.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row full">
            <label htmlFor="approvedStatusSei">
              Processo SEI <small>(opcional)</small>
            </label>
            <input
              id="approvedStatusSei"
              placeholder="Ex.: 00700.000000/2026-00"
              value={processo}
              onChange={(evento) => setProcesso(evento.target.value)}
            />
          </div>
          <div className="form-row full">
            <label htmlFor="approvedStatusMatricula">Matrícula</label>
            <input
              id="approvedStatusMatricula"
              placeholder="Informe quando o status exigir"
              required={exigeMatricula}
              aria-describedby={
                exigeMatricula ? "approvedMatriculaHint" : undefined
              }
              value={matricula}
              onChange={(evento) => setMatricula(evento.target.value)}
            />
            {exigeMatricula ? (
              <small id="approvedMatriculaHint" className="approved-field-hint">
                Obrigatória para este status.
              </small>
            ) : null}
          </div>
          <CampoDeAnexos
            jaAnexados={jaAnexados}
            arquivos={anexos}
            aoMudar={setAnexos}
          />
        </div>
        <div className="approved-modal-actions">
          <button className="btn secondary" type="button" onClick={fechar}>
            Cancelar
          </button>
          <BotaoDeAcao
            estado={estado}
            acao="status"
            id="approvedStatusSave"
            className="btn green"
            disabled={anexosInvalidos}
            onClick={() =>
              void estado.salvarStatus(candidato.candidato_id, {
                status,
                processo,
                matricula,
                anexos,
              })
            }
          >
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Salvar
            status
          </BotaoDeAcao>
        </div>
      </div>
    </Modal>
  );
}

const dataCurta = (valor) => {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleDateString("pt-BR");
};

/* Os anexos de um candidato: abrir cada PDF e, para quem altera o status, remover. */
export function ModalDeAnexos({ estado, perfil, candidato, anexos }) {
  const fechar = estado.fecharModal;
  const podeRemover = canEditCandidateStatus(perfil, candidato);
  return (
    <Modal
      id="approvedAnexosModal"
      className="approved-modal"
      cartaoClassName="approved-modal-card"
      rotuloId="approvedAnexosTitle"
      aoFechar={fechar}
    >
      <Cabecalho
        tituloId="approvedAnexosTitle"
        titulo="Anexos do candidato"
        subtitulo={`${candidato.nome} · ${candidato.cargo}`}
        aoFechar={fechar}
      />
      <div className="modal-body">
        {anexos.length ? (
          <ul id="approvedAnexosLista" className="approved-anexos-lista">
            {anexos.map((anexo) => (
              <li key={anexo.anexo_id}>
                <span className="approved-anexo-icone">
                  <IconeDePdf />
                </span>
                <div>
                  <strong>{anexo.arquivo_nome}</strong>
                  <small>
                    {formatarTamanho(anexo.tamanho)}
                    {anexo.incluido_em
                      ? ` · ${dataCurta(anexo.incluido_em)}`
                      : ""}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  data-approved-action="abrir-anexo"
                  aria-label={`Abrir ${anexo.arquivo_nome}`}
                  onClick={() => void estado.abrirAnexo(anexo)}
                >
                  <i
                    className="fa-solid fa-arrow-up-right-from-square"
                    aria-hidden="true"
                  />{" "}
                  Abrir
                </button>
                {podeRemover ? (
                  <BotaoDeAcao
                    estado={estado}
                    acao={`remover-anexo:${anexo.anexo_id}`}
                    soIcone
                    className="approved-icone-acao perigo"
                    data-approved-action="remover-anexo"
                    title="Remover anexo"
                    aria-label={`Remover ${anexo.arquivo_nome}`}
                    onClick={() => void estado.removerAnexo(anexo)}
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </BotaoDeAcao>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="approved-empty">Nenhum anexo para este candidato.</p>
        )}
        <div className="approved-modal-actions">
          <button className="btn secondary" type="button" onClick={fechar}>
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}

const cargosDoEdital = (candidatos, editalId) =>
  uniqueCandidateCargos(
    candidatos.filter((row) => String(row.edital_id) === String(editalId)),
  );

export function ModalSubJudice({ estado, listas, candidatos }) {
  const ativas = listas.filter((item) => item.ativo);
  const [nome, setNome] = useState("");
  const [nota, setNota] = useState("");
  const [editalId, setEditalId] = useState(() =>
    String(ativas[0]?.edital_id ?? ""),
  );
  const cargos = cargosDoEdital(candidatos, editalId);
  const [cargoEscolhido, setCargo] = useState(() => cargos[0] ?? "");
  // Trocar de edital troca os cargos; o escolhido que não existe lá cai no primeiro.
  const cargo = cargos.includes(cargoEscolhido)
    ? cargoEscolhido
    : (cargos[0] ?? "");
  const fechar = estado.fecharModal;

  return (
    <Modal
      id="subJudiceModal"
      className="approved-modal"
      cartaoClassName="approved-modal-card"
      rotuloId="subJudiceTitle"
      aoFechar={fechar}
    >
      <Cabecalho
        tituloId="subJudiceTitle"
        titulo="Incluir candidato sub judice"
        subtitulo="O candidato será identificado como sub judice e ficará vinculado à lista vigente do edital."
        aoFechar={fechar}
      />
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-row full">
            <label htmlFor="subJudiceNome">Nome do candidato</label>
            <input
              id="subJudiceNome"
              data-foco-inicial
              placeholder="Nome completo"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="subJudiceEdital">Edital</label>
            <select
              id="subJudiceEdital"
              value={editalId}
              onChange={(evento) => setEditalId(evento.target.value)}
            >
              {ativas.map((item) => (
                <option key={item.edital_id} value={String(item.edital_id)}>
                  {`${item.edital || "Edital"} · ${item.unidade || ""}`}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="subJudiceCargo">Cargo</label>
            <select
              id="subJudiceCargo"
              value={cargo}
              onChange={(evento) => setCargo(evento.target.value)}
            >
              {cargos.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row full">
            <label htmlFor="subJudiceNota">Nota</label>
            <input
              id="subJudiceNota"
              inputMode="decimal"
              placeholder="Ex.: 87,50"
              value={nota}
              onChange={(evento) => setNota(evento.target.value)}
            />
          </div>
        </div>
        <div className="approved-modal-actions">
          <button className="btn secondary" type="button" onClick={fechar}>
            Cancelar
          </button>
          <BotaoDeAcao
            estado={estado}
            acao="sub-judice"
            id="subJudiceSave"
            className="btn green"
            onClick={() =>
              void estado.incluirSubJudice({ editalId, cargo, nome, nota })
            }
          >
            <i className="fa-solid fa-user-plus" aria-hidden="true" /> Incluir
            sub judice
          </BotaoDeAcao>
        </div>
      </div>
    </Modal>
  );
}
