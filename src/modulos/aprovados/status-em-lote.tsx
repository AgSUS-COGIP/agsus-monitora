import type {
  CandidatoDaTabelaDeAprovados,
  EstadoDaAbaDeAprovados,
} from "./tipos-da-aba-de-aprovados.ts";
import { useMemo, useState } from "react";
import {
  LIMITE_DO_LOTE,
  editaisDoLote,
  motivosDeFora,
  planejarStatusEmLote,
  resumoDoStatusAtual,
  rotuloDoStatusDoLote,
  statusDoLotePara,
  textoDaConfirmacaoDoLote,
} from "../../lib/status-em-lote-dos-aprovados.ts";
import { statusEhConvocado } from "../../lib/lista-aprovados-rules.ts";
import { formatNumberBR } from "../../lib/formatters";
import { BotaoDeAcao, Modal } from "../../ui/index.ts";
import { plural } from "./partes.tsx";

/*
  "Mudar status" da seleção na aba Aprovados (11/11/2026): escolhe o status
  (Convocado pede a data, uma para todos), mostra como estão hoje os que vão
  mudar e quem fica de fora, com o motivo, e só então grava
  (estado.alterarStatusEmLote → alterar_status_candidatos_aprovados). O banco
  repete as regras, um a um. Contratado e Migração não entram: pedem a
  matrícula de cada um (a mudança de um por vez, na linha).
*/

export function ModalDoStatusEmLote({
  estado,
  perfil,
  candidatos,
  aoFechar,
  aoConcluir,
}: {
  estado: EstadoDaAbaDeAprovados;
  perfil: unknown;
  candidatos: readonly CandidatoDaTabelaDeAprovados[];
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const opcoes = statusDoLotePara(perfil);
  const hoje = estado.carta.hoje();
  const [status, setStatus] = useState(opcoes[0] ?? "");
  const [data, setData] = useState(hoje);
  const plano = useMemo(
    () => planejarStatusEmLote(perfil, candidatos, status),
    [perfil, candidatos, status],
  );
  const convocado = statusEhConvocado(status);
  const passou = plano.alterar.length > LIMITE_DO_LOTE;
  const dataInvalida = convocado && (!data || data > hoje);
  const editais = editaisDoLote(candidatos);

  const confirmar = async () => {
    const feito = await estado.alterarStatusEmLote(
      plano.alterar.map((c) => c.candidato_id),
      status,
      convocado ? data : "",
    );
    if (feito) aoConcluir();
  };

  return (
    <Modal
      id="approvedStatusEmLoteModal"
      className="approved-modal"
      cartaoClassName="approved-modal-card"
      rotuloId="approvedStatusEmLoteTitulo"
      aoFechar={aoFechar}
    >
      <div className="modal-head">
        <div>
          <h3 id="approvedStatusEmLoteTitulo">Mudar status da seleção</h3>
          <p className="approved-modal-subtitle">
            {[plural(candidatos.length, "selecionado", "selecionados"), editais]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button className="btn secondary" type="button" onClick={aoFechar}>
          Fechar
        </button>
      </div>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-row full">
            <label htmlFor="approvedStatusEmLoteSelect">Novo status</label>
            <select
              id="approvedStatusEmLoteSelect"
              data-foco-inicial
              value={status}
              onChange={(evento) => setStatus(evento.target.value)}
            >
              {opcoes.map((opcao) => (
                <option key={opcao || "sem-status"} value={opcao}>
                  {rotuloDoStatusDoLote(opcao)}
                </option>
              ))}
            </select>
            <small className="approved-field-hint">
              Contratado e Migração pedem a matrícula de cada um: mude na linha
              do candidato.
            </small>
          </div>
          {convocado ? (
            <div className="form-row full">
              <label htmlFor="approvedStatusEmLoteData">
                Data da convocação
              </label>
              <input
                id="approvedStatusEmLoteData"
                type="date"
                max={hoje}
                value={data}
                onChange={(evento) => setData(evento.target.value)}
              />
            </div>
          ) : null}
        </div>
        <div className="approved-lote-resumo" data-resumo-do-lote>
          <p>
            <strong>
              {plano.alterar.length
                ? `${plural(plano.alterar.length, "candidato muda", "candidatos mudam")}`
                : "Nenhum candidato muda"}
            </strong>
            {plano.alterar.length
              ? ` · hoje: ${resumoDoStatusAtual(plano.alterar)}`
              : null}
          </p>
          {plano.fora.length ? (
            <div data-fora-do-lote>
              <p>Ficam de fora {formatNumberBR(plano.fora.length)}:</p>
              <ul>
                {motivosDeFora(plano.fora).map((motivo) => (
                  <li key={motivo}>{motivo}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {passou ? (
            <p className="approved-lote-aviso" role="alert">
              No máximo {formatNumberBR(LIMITE_DO_LOTE)} por vez: filtre por
              edital ou cargo e repita.
            </p>
          ) : null}
        </div>
        <div className="approved-modal-actions">
          <button className="btn secondary" type="button" onClick={aoFechar}>
            Cancelar
          </button>
          <BotaoDeAcao
            estado={estado}
            acao="status-em-lote"
            className="btn"
            data-confirmar-lote
            disabled={!plano.alterar.length || passou || dataInvalida}
            onClick={() => void confirmar()}
          >
            {textoDaConfirmacaoDoLote(plano.alterar.length, status)}
          </BotaoDeAcao>
        </div>
      </div>
    </Modal>
  );
}
