import { useRef, useState } from "react";
import {
  canImportApprovedList,
  canReplaceApprovedList,
} from "../../lib/access-roles.js";
import { formatNumberBR } from "../../lib/formatters.js";
import { PLANILHAS } from "../../lib/planilhas.js";
import {
  MOTIVO_MAXIMO,
  origemDaLista,
} from "../../lib/publicacao-de-aprovados.js";
import { Abas, Aviso, BotaoDeAcao, classes, Modal } from "../../ui/index.js";
import { FormularioDeConvocacao } from "./formulario-de-convocacao.jsx";

/*
  O modal "Listas do edital", aberto pelo Núcleo (`openImportModal` do
  controlador) com a página de aprovados possivelmente escondida — por isso é
  um portal. Duas abas: o XLSX da lista de aprovados e a configuração da lista
  de convocação (`formulario-de-convocacao.jsx`).

  A lista de aprovados vem do resultado final da Classificação quando o edital
  tem análise no sistema (migration 20261005160000): o modal diz a origem da
  lista vigente, oferece "Publicar da Classificação" (leva à Classificação no
  edital) e, para trocar pela planilha uma lista publicada de lá, pede o
  motivo. O XLSX continua para os editais sem análise no sistema.
*/

const dataBR = (valor) => {
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

const MODELO = PLANILHAS.modeloListaAprovados;
const TIPOS_ACEITOS =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function ResumoDaListaAtual({ lista, podeSubstituir }) {
  if (!lista)
    return <span className="approved-status neutral">Sem lista importada</span>;
  const origem = origemDaLista(lista);
  const daClassificacao = origem.tipo === "CLASSIFICACAO";
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
        </div>
        <span
          className={`approved-status ${lista.ativo ? "success" : "neutral"}`}
        >
          {lista.ativo ? "Lista ativa" : "Lista inativa"}
        </span>
      </div>
      <div className="approved-import-summary-details">
        <div className="approved-import-summary-detail">
          <span>Origem</span>
          <strong data-origem-da-lista={origem.tipo}>{origem.texto}</strong>
        </div>
        {daClassificacao ? null : (
          <div className="approved-import-summary-detail">
            <span>Arquivo atual</span>
            <strong>{lista.arquivo_nome || "Arquivo importado"}</strong>
          </div>
        )}
        <div className="approved-import-summary-detail compact">
          <span>Candidatos</span>
          <strong>
            {formatNumberBR(lista.total_candidatos ?? 0)} candidatos
          </strong>
        </div>
      </div>
      {podeSubstituir ? (
        <div className="approved-import-replace-warning">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>
            {daClassificacao
              ? "Atenção: a lista foi publicada da Classificação; trocar pela planilha exige motivo."
              : "Atenção: enviar um novo XLSX substituirá a lista atual."}
          </span>
        </div>
      ) : null}
    </>
  );
}

function DaClassificacao({ estado, editalId, rotulo, publicacao }) {
  const dados = publicacao?.dados;
  if (!dados) return null;
  const final = dados.resultado_final;
  if (!final && !dados.tem_analises) return null;
  return (
    <Aviso tom="info" papel="status" className="approved-import-classificacao">
      <span>
        {final
          ? `Este edital tem resultado final na Classificação (gerado em ${dataBR(final.gerada_em)}).`
          : "Este edital tem análises no sistema: a lista de aprovados sai do resultado final da Classificação."}
      </span>
      <button
        type="button"
        className="btn secondary"
        data-acao="ir-para-classificacao"
        onClick={() => estado.irParaClassificacao(editalId, rotulo)}
      >
        <i className="fa-solid fa-list-ol" aria-hidden="true" />{" "}
        {final ? "Publicar da Classificação" : "Abrir a Classificação"}
      </button>
    </Aviso>
  );
}

function HistoricoDasPublicacoes({ publicacao }) {
  const lista = publicacao?.dados?.publicacoes || [];
  if (!lista.length) return null;
  return (
    <details className="approved-import-historico">
      <summary>Histórico das publicações ({lista.length})</summary>
      <ul>
        {lista.map((p) => (
          <li key={p.id}>
            <strong>{dataBR(p.em)}</strong> ·{" "}
            {p.origem === "CLASSIFICACAO"
              ? `Classificação (regra v${p.versao_regra}): ${p.candidatos} candidatos, +${p.entram} −${p.saem}, ${p.mudam} mudaram de posição`
              : `Planilha: ${p.candidatos} candidatos`}
            {p.por ? ` · ${p.por}` : ""}
            {p.motivo ? ` · Motivo: ${p.motivo}` : ""}
            {p.pendencias?.length
              ? ` · ${p.pendencias.length} para revisar: ${p.pendencias.map((x) => x.nome).join(", ")}`
              : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

function PainelDoArquivo({
  ativa,
  estado,
  perfil,
  editalId,
  rotulo,
  lista,
  publicacao,
}) {
  const arquivo = useRef(null);
  const [motivo, setMotivo] = useState("");
  const daClassificacao = origemDaLista(lista)?.tipo === "CLASSIFICACAO";
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
      className={classes(
        "approved-tabpanel approved-import-painel-arquivo",
        !ativa && "hidden",
      )}
      role="tabpanel"
      aria-labelledby="approvedImportTabArquivo"
    >
      <div
        id="approvedImportCurrentState"
        className={classes("approved-import-state", lista && "has-list")}
      >
        <ResumoDaListaAtual lista={lista} podeSubstituir={podeSubstituir} />
      </div>
      <DaClassificacao
        estado={estado}
        editalId={editalId}
        rotulo={rotulo}
        publicacao={publicacao}
      />
      {soLeitura ? (
        <p id="approvedImportPermissionNote" className="modal-note">
          Só admin substitui ou remove o XLSX.
        </p>
      ) : null}
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
        {daClassificacao && !soLeitura ? (
          <div className="form-row full">
            <label htmlFor="approvedImportMotivo">
              Motivo para trocar pela planilha
            </label>
            <textarea
              id="approvedImportMotivo"
              rows={2}
              maxLength={MOTIVO_MAXIMO}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          </div>
        ) : null}
        <div className="form-row full">
          <label htmlFor="approvedImportActive">Situação da lista</label>
          <select
            id="approvedImportActive"
            value={escolhida}
            onChange={(evento) => setEscolhida(evento.target.value)}
          >
            <option value="true">Ativa — permite alterar candidatos</option>
            <option value="false">Inativa</option>
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
        {lista && !daClassificacao ? (
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
          <BotaoDeAcao
            estado={estado}
            acao="remover-lista"
            id="approvedImportRemove"
            className="btn red"
            onClick={() => void estado.removerLista(editalId)}
          >
            <i className="fa-solid fa-trash" aria-hidden="true" /> Remover lista
          </BotaoDeAcao>
        ) : null}
        <span className="approved-action-spacer" />
        {lista && podeImportar ? (
          <BotaoDeAcao
            estado={estado}
            acao="lista-ativa"
            id="approvedImportToggleActive"
            className="btn secondary"
            onClick={() => void estado.definirListaAtiva({ editalId, ativo })}
          >
            <i className="fa-solid fa-power-off" aria-hidden="true" /> Aplicar
            situação
          </BotaoDeAcao>
        ) : null}
        {podeImportar && !soLeitura ? (
          <BotaoDeAcao
            estado={estado}
            acao="importar"
            id="approvedImportSubmit"
            className="btn green"
            onClick={() =>
              void estado.importarLista({
                editalId,
                arquivo: arquivo.current?.files?.[0] || null,
                ativo,
                motivo,
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
          </BotaoDeAcao>
        ) : null}
      </div>
      <HistoricoDasPublicacoes publicacao={publicacao} />
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
  const publicacao =
    String(dados.publicacao?.editalId ?? "") === String(editalId)
      ? dados.publicacao
      : null;
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
        <Abas
          rotulo="Seções do formulário do edital"
          compactas
          ativa={aba}
          aoEscolher={setAba}
          abas={ABAS.map((item) => ({
            id: item.nome,
            rotulo: item.rotulo,
            icone: item.icone,
            idDaAba: item.id,
            idDoPainel: item.painel,
            dados: { "data-import-tab": item.nome },
          }))}
        />
        <PainelDoArquivo
          ativa={aba === "arquivo"}
          estado={estado}
          perfil={perfil}
          editalId={editalId}
          rotulo={rotulo}
          lista={lista}
          publicacao={publicacao}
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
