import { useRef, useState } from "react";
import {
  canImportApprovedList,
  canReplaceApprovedList,
  normalizeRole,
} from "../../lib/access-roles.js";
import { PLANILHAS } from "../../lib/planilhas.js";
import { Modal } from "../modal.jsx";
import { FormularioDeConvocacao } from "./formulario-de-convocacao.jsx";
import { classes } from "./partes.jsx";

/*
  O modal "Listas do edital", aberto pelo Núcleo (`openImportModal` do
  controlador) com a página de aprovados possivelmente escondida — por isso é
  um portal. Duas abas: o XLSX da lista de aprovados e a configuração da lista
  de convocação (`formulario-de-convocacao.jsx`).
*/

const MODELO = PLANILHAS.modeloListaAprovados;
const TIPOS_ACEITOS =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function ResumoDaListaAtual({ lista, podeSubstituir }) {
  if (!lista)
    return <span className="approved-status neutral">Sem lista importada</span>;
  return (
    <>
      <div className="approved-import-summary-head">
        <span className="approved-import-summary-icon" aria-hidden="true">
          <i className="fa-solid fa-file-circle-check" />
        </span>
        <div className="approved-import-summary-copy">
          <strong className="approved-import-summary-title">
            Lista atual cadastrada
          </strong>
          <span>Este edital já possui uma lista de aprovados importada.</span>
        </div>
        <span
          className={`approved-status ${lista.ativo ? "success" : "neutral"}`}
        >
          {lista.ativo ? "Lista ativa" : "Lista inativa"}
        </span>
      </div>
      <div className="approved-import-summary-details">
        <div className="approved-import-summary-detail">
          <span>Arquivo atual</span>
          <strong>{lista.arquivo_nome || "Arquivo importado"}</strong>
        </div>
        <div className="approved-import-summary-detail compact">
          <span>Candidatos</span>
          <strong>{String(lista.total_candidatos ?? 0)} candidatos</strong>
        </div>
      </div>
      {podeSubstituir ? (
        <div className="approved-import-replace-warning">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>Atenção: enviar um novo XLSX substituirá a lista atual.</span>
        </div>
      ) : null}
    </>
  );
}

function PainelDoArquivo({ ativa, estado, perfil, editalId, lista }) {
  const arquivo = useRef(null);
  const podeImportar = canImportApprovedList(perfil);
  const podeSubstituir = canReplaceApprovedList(perfil);
  const soLeitura = Boolean(lista && !podeSubstituir);

  // A situação escolhida acompanha a da lista quando esta muda no banco.
  const situacao = lista?.ativo === false ? "false" : "true";
  const [escolhida, setEscolhida] = useState(situacao);
  const [situacaoVista, setSituacaoVista] = useState(situacao);
  if (situacao !== situacaoVista) {
    setSituacaoVista(situacao);
    setEscolhida(situacao);
  }
  const ativo = escolhida !== "false";

  return (
    <div
      id="approvedImportPanelArquivo"
      className={classes("approved-tabpanel", !ativa && "hidden")}
      role="tabpanel"
      aria-labelledby="approvedImportTabArquivo"
    >
      <div
        id="approvedImportCurrentState"
        className={classes("approved-import-state", lista && "has-list")}
      >
        <ResumoDaListaAtual lista={lista} podeSubstituir={podeSubstituir} />
      </div>
      <p id="approvedImportPermissionNote" className="modal-note">
        {soLeitura
          ? `A lista já foi importada. O perfil ${normalizeRole(perfil) || "atual"} pode ativar/inativar, mas somente admin pode substituir ou remover o XLSX.`
          : "A importação cria candidatos vinculados a este edital pelo ID do registro da Equipe Núcleo."}
      </p>
      <div className="form-grid">
        <div
          id="approvedImportFileRow"
          className={classes("form-row full", soLeitura && "hidden")}
        >
          <label htmlFor="approvedImportFile">Arquivo XLSX</label>
          {/* Uma lista nova (ou nenhuma) limpa o arquivo escolhido. */}
          <input
            key={lista?.lista_id ?? "sem-lista"}
            ref={arquivo}
            id="approvedImportFile"
            type="file"
            accept={TIPOS_ACEITOS}
          />
          <small className="approved-field-hint">
            Colunas obrigatórias: codigo_vaga, cargo, classificacao, nota, nome
            e modalidade.
          </small>
        </div>
        <div className="form-row full">
          <label htmlFor="approvedImportActive">Situação da lista</label>
          <select
            id="approvedImportActive"
            value={escolhida}
            onChange={(evento) => setEscolhida(evento.target.value)}
          >
            <option value="true">Ativa — permite alterar candidatos</option>
            <option value="false">Inativa — somente consulta</option>
          </select>
        </div>
      </div>
      <div className="approved-import-links">
        <a
          id="approvedImportModelLink"
          className="btn outline"
          href={MODELO.url}
          download={MODELO.nomeDoArquivo}
        >
          <i className="fa-solid fa-download" aria-hidden="true" /> Baixar
          modelo de importação
        </a>
        {lista ? (
          <button
            id="approvedImportDownloadCurrent"
            className="btn outline"
            type="button"
            onClick={() => void estado.baixarArquivoAtual(editalId)}
          >
            <i className="fa-solid fa-file-excel" aria-hidden="true" /> Baixar
            XLSX atual
          </button>
        ) : null}
      </div>
      <div className="approved-modal-actions approved-import-actions">
        {lista && podeSubstituir ? (
          <button
            id="approvedImportRemove"
            className="btn red"
            type="button"
            onClick={() => void estado.removerLista(editalId)}
          >
            <i className="fa-solid fa-trash" aria-hidden="true" /> Remover lista
          </button>
        ) : null}
        <span className="approved-action-spacer" />
        {lista && podeImportar ? (
          <button
            id="approvedImportToggleActive"
            className="btn secondary"
            type="button"
            onClick={() => void estado.definirListaAtiva({ editalId, ativo })}
          >
            <i className="fa-solid fa-power-off" aria-hidden="true" /> Aplicar
            situação
          </button>
        ) : null}
        {podeImportar && !soLeitura ? (
          <button
            id="approvedImportSubmit"
            className="btn green"
            type="button"
            onClick={() =>
              void estado.importarLista({
                editalId,
                arquivo: arquivo.current?.files?.[0] || null,
                ativo,
              })
            }
          >
            {lista ? (
              <>
                <i className="fa-solid fa-rotate" aria-hidden="true" />{" "}
                Substituir XLSX
              </>
            ) : (
              <>
                <i className="fa-solid fa-file-import" aria-hidden="true" />{" "}
                Importar lista
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const ABAS = [
  {
    nome: "arquivo",
    id: "approvedImportTabArquivo",
    painel: "approvedImportPanelArquivo",
    icone: "fa-file-arrow-up",
    rotulo: "Lista de aprovados",
  },
  {
    nome: "convocacao",
    id: "approvedImportTabConvocacao",
    painel: "approvedImportPanelConvocacao",
    icone: "fa-bullhorn",
    rotulo: "Lista de convocação",
  },
];

export function ModalListasDoEdital({ estado, dados, editalId, rotulo }) {
  const [aba, setAba] = useState("arquivo");
  const { perfil, listas, candidatos, configs, modelos } = dados;
  const lista = listas.find(
    (row) => String(row.edital_id) === String(editalId),
  );
  const fechar = estado.fecharModal;

  return (
    <Modal
      id="approvedImportModal"
      className="approved-modal"
      cartaoClassName="approved-modal-card approved-import-card"
      rotuloId="approvedImportTitle"
      aoFechar={fechar}
    >
      <div className="modal-head">
        <div>
          <h3 id="approvedImportTitle">Listas do edital</h3>
          <p id="approvedImportEdital" className="approved-modal-subtitle">
            {rotulo || "Edital"}
          </p>
        </div>
        <button className="btn secondary" type="button" onClick={fechar}>
          Fechar
        </button>
      </div>
      <div className="modal-body">
        <div
          className="approved-tabs approved-tabs-modal"
          role="tablist"
          aria-label="Seções do formulário do edital"
        >
          {ABAS.map((item) => (
            <button
              key={item.nome}
              id={item.id}
              className={classes("approved-tab", aba === item.nome && "active")}
              type="button"
              role="tab"
              aria-selected={aba === item.nome}
              aria-controls={item.painel}
              data-import-tab={item.nome}
              onClick={() => setAba(item.nome)}
            >
              <i className={`fa-solid ${item.icone}`} aria-hidden="true" />{" "}
              {item.rotulo}
            </button>
          ))}
        </div>
        <PainelDoArquivo
          ativa={aba === "arquivo"}
          estado={estado}
          perfil={perfil}
          editalId={editalId}
          lista={lista}
        />
        <FormularioDeConvocacao
          ativa={aba === "convocacao"}
          estado={estado}
          perfil={perfil}
          editalId={editalId}
          candidatos={candidatos}
          configs={configs}
          modelos={modelos}
        />
      </div>
    </Modal>
  );
}
