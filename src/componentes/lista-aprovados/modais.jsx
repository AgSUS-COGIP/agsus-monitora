import { useState } from "react";
import {
  STATUS_DO_CANDIDATO,
  statusNeedsMatricula,
  uniqueCandidateCargos,
} from "../../lib/lista-aprovados-rules.js";
import { Modal } from "../modal.jsx";

/*
  Os modais de status do candidato e de inclusão sub judice. Cada abertura é
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

export function ModalDeStatus({ estado, candidato }) {
  const [status, setStatus] = useState(candidato.status || "");
  const [processo, setProcesso] = useState(candidato.processo_sei || "");
  const [matricula, setMatricula] = useState(candidato.matricula || "");
  const exigeMatricula = statusNeedsMatricula(status);
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
              aria-describedby="approvedMatriculaHint"
              value={matricula}
              onChange={(evento) => setMatricula(evento.target.value)}
            />
            <small id="approvedMatriculaHint" className="approved-field-hint">
              {exigeMatricula
                ? "Obrigatória para este status."
                : "Opcional para este status."}
            </small>
          </div>
        </div>
        <div className="approved-modal-actions">
          <button className="btn secondary" type="button" onClick={fechar}>
            Cancelar
          </button>
          <button
            id="approvedStatusSave"
            className="btn green"
            type="button"
            onClick={() =>
              void estado.salvarStatus(candidato.candidato_id, {
                status,
                processo,
                matricula,
              })
            }
          >
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Salvar
            status
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
          <button
            id="subJudiceSave"
            className="btn green"
            type="button"
            onClick={() =>
              void estado.incluirSubJudice({ editalId, cargo, nome, nota })
            }
          >
            <i className="fa-solid fa-user-plus" aria-hidden="true" /> Incluir
            sub judice
          </button>
        </div>
      </div>
    </Modal>
  );
}
